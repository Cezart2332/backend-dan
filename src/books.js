import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { mysqlPool } from './mysql.js';
import { sendBooksEmail } from './email.js';

// Cartile PDF cadou pentru abonatii Premium si VIP: se trimit o singura data
// pe cont — fie in masa din panou, fie automat la primul abonament Premium/VIP.

const BOOK_KEYS = ['pdf1', 'pdf2'];
export const BOOK_SUBSCRIPTION_TYPES = ['premium', 'vip'];
// Resend accepta maximum 40MB per email, calculat dupa codarea base64.
const MAX_EMAIL_BYTES = 40 * 1024 * 1024;
const SEND_INTERVAL_MS = Math.max(250, Number(process.env.BOOKS_SEND_INTERVAL_MS || 600));
// O trimitere ramasa „in curs” (ex. serverul a repornit) poate fi reluata dupa acest timp.
const STALE_SENDING_MINUTES = 30;
const TYPE_PLACEHOLDERS = BOOK_SUBSCRIPTION_TYPES.map(() => '?').join(', ');

function mediaBasePath() {
  return (
    process.env.FileStorage__BasePath ||
    process.env.FILESTORAGE__BASEPATH ||
    process.env.FILE_STORAGE_BASE_PATH ||
    ''
  ).trim();
}

/**
 * Folderul cu pdf1.pdf si pdf2.pdf. Implicit in volumul persistent de media,
 * ca fisierele sa nu dispara la redeploy.
 */
export function getBooksDir() {
  if (process.env.BOOKS_DIR) return path.resolve(process.env.BOOKS_DIR);
  const base = mediaBasePath();
  if (base) return path.join(base, 'books');
  return process.platform === 'win32'
    ? path.resolve(process.cwd(), 'media/books')
    : '/app/media/books';
}

function attachmentName(key) {
  const fromEnv = String(process.env[`BOOK_${key.toUpperCase()}_NAME`] || '').trim();
  const name = fromEnv || (key === 'pdf1' ? 'Cartea 1 - Dan fost anxios' : 'Cartea 2 - Dan fost anxios');
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

async function findBookFile(key) {
  const dir = getBooksDir();
  for (const candidate of [`${key}.pdf`, `${key}.PDF`, key]) {
    const fullPath = path.join(dir, candidate);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isFile()) return { path: fullPath, size: stat.size };
    } catch {
      // Incearca urmatorul nume posibil.
    }
  }
  return null;
}

export async function getBooksFilesStatus() {
  const dir = getBooksDir();
  // Folderul exista din start, ca PDF-urile sa poata fi copiate direct in el.
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
  const files = await Promise.all(
    BOOK_KEYS.map(async (key) => {
      const found = await findBookFile(key);
      return {
        key,
        found: Boolean(found) && found.size > 0,
        path: found?.path || path.join(dir, `${key}.pdf`),
        size: found?.size || 0,
        attachmentName: attachmentName(key),
      };
    })
  );
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const encodedBytes = Math.ceil(totalBytes / 3) * 4;
  const allFound = files.every((file) => file.found);

  return {
    dir,
    files,
    totalBytes,
    encodedBytes,
    maxEmailBytes: MAX_EMAIL_BYTES,
    ready: allFound && encodedBytes <= MAX_EMAIL_BYTES,
  };
}

async function loadAttachments() {
  const status = await getBooksFilesStatus();
  const missing = status.files.filter((file) => !file.found).map((file) => `${file.key}.pdf`);
  if (missing.length) {
    throw new Error(`Lipsesc fisierele ${missing.join(', ')} din ${status.dir}`);
  }
  if (status.encodedBytes > MAX_EMAIL_BYTES) {
    const mb = (status.encodedBytes / 1024 / 1024).toFixed(1);
    throw new Error(`PDF-urile sunt prea mari pentru un singur email (${mb}MB dupa codare, maxim 40MB)`);
  }
  return Promise.all(
    status.files.map(async (file) => ({
      filename: file.attachmentName,
      content: await fs.promises.readFile(file.path),
    }))
  );
}

/**
 * Rezerva livrarea pentru un cont. Doar un apel castiga (token-ul lui ramane
 * in rand), asa ca webhook-ul si sincronizarea simultane nu trimit de doua ori.
 */
async function claimDelivery(userId, source) {
  const token = randomUUID();
  const reclaimable = `(status = 'failed' OR (status = 'sending' AND updated_at < NOW() - INTERVAL ${STALE_SENDING_MINUTES} MINUTE))`;
  await mysqlPool.query(
    `INSERT INTO book_deliveries (user_id, status, source, attempts, claim_token)
     VALUES (?, 'sending', ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       attempts = IF(${reclaimable}, attempts + 1, attempts),
       source = IF(${reclaimable}, VALUES(source), source),
       claim_token = IF(${reclaimable}, VALUES(claim_token), claim_token),
       status = IF(${reclaimable}, 'sending', status)`,
    [userId, source, token]
  );
  const [rows] = await mysqlPool.query(
    'SELECT claim_token FROM book_deliveries WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows?.[0]?.claim_token === token ? token : null;
}

async function finishDelivery(userId, token, { sent, email = null, resendId = null, error = null }) {
  await mysqlPool.query(
    `UPDATE book_deliveries
     SET status = ?, email = ?, resend_id = ?, error = ?, sent_at = IF(? = 'sent', NOW(), sent_at)
     WHERE user_id = ? AND claim_token = ?`,
    [
      sent ? 'sent' : 'failed',
      email,
      resendId,
      error ? String(error).slice(0, 1000) : null,
      sent ? 'sent' : 'failed',
      userId,
      token,
    ]
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithRetry(params) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sendBooksEmail(params);
    } catch (error) {
      const rateLimited = error?.resendErrorName === 'rate_limit_exceeded';
      if (!rateLimited || attempt >= 3) throw error;
      await sleep(1500 * attempt);
    }
  }
}

/**
 * @returns {Promise<{ status: 'sent'|'failed'|'skipped', error?: string }>}
 */
async function deliverToUser({ userId, source, attachments, logger }) {
  const token = await claimDelivery(userId, source);
  if (!token) return { status: 'skipped' };

  const [rows] = await mysqlPool.query('SELECT email, name FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = rows?.[0];
  const email = String(user?.email || '').trim();
  if (!email) {
    await finishDelivery(userId, token, { sent: false, error: 'Contul nu are adresa de email' });
    return { status: 'failed', error: 'Contul nu are adresa de email' };
  }

  try {
    const files = attachments || (await loadAttachments());
    const data = await sendWithRetry({ email, name: user?.name, attachments: files });
    await finishDelivery(userId, token, { sent: true, email, resendId: data?.id || null });
    return { status: 'sent' };
  } catch (error) {
    const message = error?.message || String(error);
    await finishDelivery(userId, token, { sent: false, email, error: message }).catch(() => {});
    (logger || console).warn?.({ err: error, userId, source }, 'Trimiterea cartilor PDF a esuat');
    return { status: 'failed', error: message };
  }
}

/**
 * True daca utilizatorul a avut vreodata un abonament Premium/VIP inregistrat.
 * Apelat inainte de salvarea unui abonament nou, ca reinnoirile si reactivarile
 * (ex. dupa cateva luni de pauza) sa nu mai primeasca automat cartile.
 */
export async function hasHadBookEligibleSubscription(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT 1 FROM subscriptions WHERE user_id = ? AND type IN (${TYPE_PLACEHOLDERS}) LIMIT 1`,
    [userId, ...BOOK_SUBSCRIPTION_TYPES]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Trimite cartile la primul abonament Premium/VIP al contului, fara sa blocheze cererea. */
export function deliverBooksForNewSubscription(userId, logger) {
  deliverToUser({ userId: Number(userId), source: 'new_subscription', logger }).catch((error) => {
    (logger || console).error?.({ err: error, userId }, 'Livrarea automata a cartilor a esuat');
  });
}

// Abonatii Premium/VIP activi care n-au primit inca (sau carora le-a esuat) trimiterea.
const PENDING_RECIPIENTS_SQL = `
  FROM users u
  JOIN subscriptions s ON s.user_id = u.id
  LEFT JOIN book_deliveries d ON d.user_id = u.id
  WHERE s.type IN (${TYPE_PLACEHOLDERS})
    AND (s.ends_at IS NULL OR s.ends_at > NOW())
    AND u.email IS NOT NULL AND u.email <> ''
    AND (d.user_id IS NULL OR d.status = 'failed')`;

async function listPendingRecipientIds() {
  const [rows] = await mysqlPool.query(
    `SELECT DISTINCT u.id ${PENDING_RECIPIENTS_SQL} ORDER BY u.id`,
    BOOK_SUBSCRIPTION_TYPES
  );
  return (rows || []).map((row) => Number(row.id));
}

let bulkJob = null;

function publicJob() {
  return bulkJob ? { ...bulkJob } : null;
}

async function runBulkJob(userIds, attachments, logger) {
  try {
    for (const userId of userIds) {
      const result = await deliverToUser({ userId, source: 'bulk', attachments, logger });
      if (result.status === 'sent') bulkJob.sent += 1;
      else if (result.status === 'failed') {
        bulkJob.failed += 1;
        bulkJob.lastError = result.error || null;
      } else bulkJob.skipped += 1;
      await sleep(SEND_INTERVAL_MS);
    }
  } catch (error) {
    bulkJob.lastError = error?.message || String(error);
    (logger || console).error?.({ err: error }, 'Trimiterea in masa a cartilor s-a oprit');
  } finally {
    bulkJob.running = false;
    bulkJob.finishedAt = new Date().toISOString();
  }
}

/**
 * Porneste trimiterea catre toti abonatii Premium/VIP activi care nu au primit
 * inca cartile. Ruleaza in fundal; progresul se citeste cu getBulkJob().
 */
export async function startBulkDelivery(logger) {
  if (bulkJob?.running) return { started: false, reason: 'ALREADY_RUNNING', job: publicJob() };

  const attachments = await loadAttachments();
  const userIds = await listPendingRecipientIds();
  bulkJob = {
    running: userIds.length > 0,
    startedAt: new Date().toISOString(),
    finishedAt: userIds.length ? null : new Date().toISOString(),
    total: userIds.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    lastError: null,
  };
  if (userIds.length) runBulkJob(userIds, attachments, logger);
  return { started: userIds.length > 0, reason: userIds.length ? null : 'NOTHING_PENDING', job: publicJob() };
}

export function getBulkJob() {
  return publicJob();
}

export async function getBooksDeliveryStats() {
  const [[active]] = await mysqlPool.query(
    `SELECT COUNT(DISTINCT s.user_id) AS count
     FROM subscriptions s
     WHERE s.type IN (${TYPE_PLACEHOLDERS}) AND (s.ends_at IS NULL OR s.ends_at > NOW())`,
    BOOK_SUBSCRIPTION_TYPES
  );
  const [[pending]] = await mysqlPool.query(
    `SELECT COUNT(DISTINCT u.id) AS count ${PENDING_RECIPIENTS_SQL}`,
    BOOK_SUBSCRIPTION_TYPES
  );
  const [statusRows] = await mysqlPool.query(
    'SELECT status, COUNT(*) AS count FROM book_deliveries GROUP BY status'
  );
  const byStatus = Object.fromEntries((statusRows || []).map((row) => [row.status, Number(row.count)]));

  return {
    activeSubscribers: Number(active?.count || 0),
    pending: Number(pending?.count || 0),
    sent: byStatus.sent || 0,
    failed: byStatus.failed || 0,
    sending: byStatus.sending || 0,
  };
}

export async function listRecentBookDeliveries(limit = 25) {
  const [rows] = await mysqlPool.query(
    `SELECT d.user_id, d.status, d.source, d.email, d.error, d.attempts, d.sent_at, d.updated_at,
            u.name, u.email AS user_email
     FROM book_deliveries d
     LEFT JOIN users u ON u.id = d.user_id
     ORDER BY d.updated_at DESC
     LIMIT ?`,
    [Math.min(100, Math.max(1, Number(limit) || 25))]
  );
  return (rows || []).map((row) => ({
    userId: Number(row.user_id),
    name: row.name || null,
    email: row.email || row.user_email || null,
    status: row.status,
    source: row.source,
    error: row.error || null,
    attempts: Number(row.attempts || 0),
    sentAt: row.sent_at || null,
    updatedAt: row.updated_at || null,
  }));
}

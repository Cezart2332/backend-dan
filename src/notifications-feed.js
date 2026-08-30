import { mysqlPool } from './mysql.js';

const MAX_FEED_LIMIT = 50;
const PREMIUM_SUBSCRIPTION_TYPES = ['premium', 'vip', 'pro'];

function normalizeAudience(value) {
  return String(value || '').toLowerCase() === 'premium' ? 'premium' : 'all';
}

function serializeData(data) {
  if (data === undefined || data === null) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

function parseData(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatIsoDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function buildFeedItem(row) {
  return {
    id: Number(row.id),
    type: String(row.type || 'announcement'),
    title: String(row.title || ''),
    body: String(row.body || ''),
    data: parseData(row.data),
    read: Boolean(Number(row.is_read || 0)),
    createdAt: formatIsoDate(row.created_at),
  };
}

/**
 * Salveaza o notificare in feed-ul din aplicatie.
 * `userId` null inseamna anunt catre toti (filtrat de `audience`).
 *
 * @param {{ userId?: number|null, audience?: 'all'|'premium', type?: string, title: string, body: string, data?: object|null }} params
 * @returns {Promise<number|null>} ID-ul notificarii salvate.
 */
export async function recordNotification({
  userId = null,
  audience = 'all',
  type = 'announcement',
  title,
  body,
  data = null,
}) {
  const normalizedTitle = String(title || '').trim();
  const normalizedBody = String(body || '').trim();
  if (!normalizedTitle || !normalizedBody) return null;

  const [result] = await mysqlPool.query(
    `INSERT INTO app_notifications (user_id, audience, type, title, body, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number.isFinite(Number(userId)) && Number(userId) > 0 ? Number(userId) : null,
      normalizeAudience(audience),
      String(type || 'announcement').slice(0, 48),
      normalizedTitle.slice(0, 255),
      normalizedBody,
      serializeData(data),
    ]
  );

  return Number(result?.insertId || 0) || null;
}

/**
 * Varianta care nu arunca — folosita langa trimiterea push-urilor, ca
 * o eroare de scriere in feed sa nu blocheze notificarea propriu-zisa.
 *
 * @param {Parameters<typeof recordNotification>[0] & { logger?: any }} params
 * @returns {Promise<number|null>}
 */
export async function recordNotificationSafe({ logger, ...params }) {
  try {
    return await recordNotification(params);
  } catch (error) {
    logger?.error?.({ err: error }, 'Salvarea notificarii in feed a esuat');
    return null;
  }
}

function buildVisibilitySql(alias = 'n') {
  // Notificarile personale merg doar la utilizatorul tinta; anunturile
  // globale ajung la toti, iar cele "premium" doar la abonatii activi.
  return `(
    ${alias}.user_id = ?
    OR (
      ${alias}.user_id IS NULL
      AND (
        ${alias}.audience = 'all'
        OR EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.user_id = ?
            AND s.type IN (${PREMIUM_SUBSCRIPTION_TYPES.map(() => '?').join(', ')})
            AND (s.ends_at IS NULL OR s.ends_at > NOW())
        )
      )
    )
  )`;
}

/**
 * Returneaza notificarile vizibile pentru un utilizator, paginat descrescator.
 *
 * @param {number} userId
 * @param {{ before?: number|null, limit?: number }} [options]
 * @returns {Promise<{ items: Array<object>, hasMore: boolean, nextBefore: number|null, unreadCount: number }>}
 */
export async function listNotificationsForUser(userId, { before = null, limit = MAX_FEED_LIMIT } = {}) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    return { items: [], hasMore: false, nextBefore: null, unreadCount: 0 };
  }

  const normalizedLimit = Math.min(MAX_FEED_LIMIT, Math.max(1, Number(limit) || MAX_FEED_LIMIT));
  const beforeId = Number.isFinite(Number(before)) && Number(before) > 0 ? Number(before) : null;

  const params = [normalizedUserId, normalizedUserId, normalizedUserId, ...PREMIUM_SUBSCRIPTION_TYPES];
  const beforeSql = beforeId ? 'AND n.id < ?' : '';
  if (beforeId) params.push(beforeId);
  params.push(normalizedLimit + 1);

  const [rows] = await mysqlPool.query(
    `SELECT n.id, n.type, n.title, n.body, n.data, n.created_at,
            (r.notification_id IS NOT NULL) AS is_read
     FROM app_notifications n
     LEFT JOIN app_notification_reads r
       ON r.notification_id = n.id AND r.user_id = ?
     WHERE ${buildVisibilitySql('n')}
     ${beforeSql}
     ORDER BY n.id DESC
     LIMIT ?`,
    params
  );

  const normalizedRows = Array.isArray(rows) ? rows : [];
  const hasMore = normalizedRows.length > normalizedLimit;
  const pageRows = hasMore ? normalizedRows.slice(0, normalizedLimit) : normalizedRows;
  const items = pageRows.map(buildFeedItem);
  const nextBefore = items.length ? Number(items[items.length - 1].id) : null;
  const unreadCount = await countUnreadNotifications(normalizedUserId);

  return { items, hasMore, nextBefore, unreadCount };
}

/**
 * Numarul de notificari necitite pentru un utilizator.
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function countUnreadNotifications(userId) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return 0;

  const [rows] = await mysqlPool.query(
    `SELECT COUNT(*) AS unread_count
     FROM app_notifications n
     LEFT JOIN app_notification_reads r
       ON r.notification_id = n.id AND r.user_id = ?
     WHERE ${buildVisibilitySql('n')}
       AND r.notification_id IS NULL`,
    [normalizedUserId, normalizedUserId, normalizedUserId, ...PREMIUM_SUBSCRIPTION_TYPES]
  );

  return Array.isArray(rows) && rows.length ? Number(rows[0].unread_count || 0) : 0;
}

/**
 * Marcheaza notificarile ca citite. Fara `ids` marcheaza tot feed-ul.
 *
 * @param {number} userId
 * @param {number[]|null} [ids]
 * @returns {Promise<void>}
 */
export async function markNotificationsRead(userId, ids = null) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;

  const normalizedIds = Array.isArray(ids)
    ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : null;

  if (normalizedIds && !normalizedIds.length) return;

  const idFilterSql = normalizedIds
    ? `AND n.id IN (${normalizedIds.map(() => '?').join(', ')})`
    : '';

  const params = [
    normalizedUserId,
    normalizedUserId,
    normalizedUserId,
    ...PREMIUM_SUBSCRIPTION_TYPES,
    ...(normalizedIds || []),
  ];

  await mysqlPool.query(
    `INSERT IGNORE INTO app_notification_reads (user_id, notification_id)
     SELECT ?, n.id
     FROM app_notifications n
     WHERE ${buildVisibilitySql('n')}
     ${idFilterSql}`,
    params
  );
}

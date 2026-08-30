import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';
import { mysqlPool } from './mysql.js';
import { isExpoPushToken, sendPushToExpoTokens } from './push.js';
import { recordNotificationSafe } from './notifications-feed.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');

function loadAdminToken() {
  const raw = process.env.ADMIN_TOKEN || process.env.CORE_ADMIN_TOKEN || '';
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : null;
}

const ADMIN_TOKEN = loadAdminToken();
const ADMIN_STATS_CACHE_TTL_MS = Math.max(1000, Number(process.env.ADMIN_STATS_CACHE_TTL_MS || 15000));
const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'];
const WEBINAR_STATUSES = ['scheduled', 'live', 'held', 'cancelled'];
const WEBINAR_PUSH_TIMEZONE = 'Europe/Bucharest';

let adminStatsCache = null;

function invalidateAdminStatsCache() {
  adminStatsCache = null;
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized.length ? normalized : null;
}

function parseDateTimeInput(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBucharestDateTimeParts(value) {
  const parsedDate = parseDateTimeInput(value);
  if (!parsedDate) return null;

  const formatter = new Intl.DateTimeFormat('ro-RO', {
    timeZone: WEBINAR_PUSH_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(parsedDate);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    date: `${getPart('day')}.${getPart('month')}.${getPart('year')}`,
    time: `${getPart('hour')}:${getPart('minute')}`,
  };
}

function buildWebinarPushBody(webinar, fallbackText) {
  const normalizedTitle = String(webinar?.title || 'Webinar').trim();
  const status = String(webinar?.status || '').toLowerCase();
  const recordingLink = normalizeOptionalText(webinar?.recording_link);

  if (status === 'held' && recordingLink) {
    return `Webinarul "${normalizedTitle}" este disponibil acum inregistrat.`;
  }

  if (status === 'cancelled') {
    return `Webinarul "${normalizedTitle}" a fost anulat.`;
  }

  if (status === 'live') {
    return `Webinarul "${normalizedTitle}" este live acum.`;
  }

  const dateParts = getBucharestDateTimeParts(webinar?.scheduled_at);
  if (dateParts?.date && dateParts?.time) {
    return `Voi tine un webinar cu titlul ${normalizedTitle} la data de ${dateParts.date} la ora ${dateParts.time}.`;
  }

  return fallbackText;
}

function buildWebinarHeldFinishedBody(webinar) {
  const normalizedTitle = String(webinar?.title || 'Webinar').trim();
  return `Webinarul ${normalizedTitle} s-a terminat, inregistrarea va fi disponibila cat de curand posibil`;
}

function getMeetingStatusLabel(status) {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'scheduled') return 'programata';
  if (normalizedStatus === 'completed') return 'finalizata';
  if (normalizedStatus === 'cancelled') return 'anulata';
  return normalizedStatus || 'actualizat';
}

function buildMeetingPushBody({ previousMeeting, updatedMeeting, statusChanged, scheduleChanged }) {
  const normalizedTitle = String(updatedMeeting?.title || previousMeeting?.title || 'Sedinta cu Dan').trim();
  const status = String(updatedMeeting?.status || '').toLowerCase();
  const dateParts = getBucharestDateTimeParts(updatedMeeting?.scheduled_at);
  const scheduleText = dateParts?.date && dateParts?.time
    ? ` pe ${dateParts.date} la ${dateParts.time}`
    : '';

  if (status === 'cancelled') {
    return `Sedinta "${normalizedTitle}"${scheduleText} a fost anulata.`;
  }

  if (statusChanged && status === 'completed') {
    return `Sedinta "${normalizedTitle}" a fost marcata ca finalizata.`;
  }

  if (scheduleChanged) {
    return `Sedinta "${normalizedTitle}" a fost reprogramata${scheduleText}.`;
  }

  if (statusChanged) {
    return `Statusul sedintei "${normalizedTitle}" a fost actualizat (${getMeetingStatusLabel(status)}).`;
  }

  return `Sedinta "${normalizedTitle}" a fost actualizata.`;
}

async function notifyUserAboutMeetingUpdate({
  request,
  meetingId,
  userId,
  previousMeeting,
  updatedMeeting,
  statusChanged,
  scheduleChanged,
}) {
  const pushTitle = 'Actualizare sedinta cu Dan';
  const pushBody = buildMeetingPushBody({ previousMeeting, updatedMeeting, statusChanged, scheduleChanged });

  await recordNotificationSafe({
    userId: Number(userId),
    type: 'meeting_updated',
    title: pushTitle,
    body: pushBody,
    data: { meetingId, status: updatedMeeting?.status || null },
    logger: request.log,
  });

  const [tokenRows] = await mysqlPool.query(
    'SELECT expo_push_token FROM user_push_tokens WHERE user_id = ? AND enabled = 1',
    [Number(userId)]
  );

  const pushTokens = (Array.isArray(tokenRows) ? tokenRows : [])
    .map((row) => row.expo_push_token)
    .filter((token) => isExpoPushToken(token));

  if (!pushTokens.length) return 0;

  const pushResult = await sendPushToExpoTokens({
    tokens: pushTokens,
    title: pushTitle,
    body: pushBody,
    data: {
      type: 'meeting_updated',
      meetingId,
      status: updatedMeeting?.status || null,
      scheduledAt: updatedMeeting?.scheduled_at || null,
      statusChanged,
      scheduleChanged,
    },
    logger: request.log,
  });

  const invalidTokens = Array.isArray(pushResult?.invalidTokens) ? pushResult.invalidTokens : [];
  if (invalidTokens.length) {
    await disableInvalidPushTokens(invalidTokens);
  }

  return Number(pushResult?.sentCount || 0);
}

async function disableInvalidPushTokens(invalidTokens) {
  if (!Array.isArray(invalidTokens) || !invalidTokens.length) return;
  const placeholders = invalidTokens.map(() => '?').join(', ');
  await mysqlPool.query(
    `UPDATE user_push_tokens
     SET enabled = 0, updated_at = CURRENT_TIMESTAMP
     WHERE expo_push_token IN (${placeholders})`,
    invalidTokens
  );
}

async function notifyPremiumVipUsersAboutWebinar({ request, webinar, webinarId, type, bodyOverride = null }) {
  const body =
    String(bodyOverride || '').trim() ||
    buildWebinarPushBody(
      webinar,
      type === 'webinar_created' ? 'Am publicat un webinar nou.' : 'Webinarul a fost actualizat.'
    );

  await recordNotificationSafe({
    audience: 'premium',
    type,
    title: 'Webinarii Dan',
    body,
    data: { webinarId },
    logger: request.log,
  });

  const [tokenRows] = await mysqlPool.query(
    `SELECT DISTINCT upt.expo_push_token
     FROM user_push_tokens upt
     INNER JOIN subscriptions s ON s.user_id = upt.user_id
     WHERE upt.enabled = 1
       AND s.type IN ('premium', 'vip', 'pro')
       AND (s.ends_at IS NULL OR s.ends_at > NOW())`
  );

  const pushTokens = (Array.isArray(tokenRows) ? tokenRows : [])
    .map((row) => row.expo_push_token)
    .filter((token) => isExpoPushToken(token));

  if (!pushTokens.length) return 0;

  const pushResult = await sendPushToExpoTokens({
    tokens: pushTokens,
    title: 'Webinarii Dan',
    body,
    data: {
      type,
      webinarId,
      status: webinar?.status || null,
      scheduledAt: webinar?.scheduled_at || null,
    },
    logger: request.log,
  });

  const invalidTokens = Array.isArray(pushResult?.invalidTokens) ? pushResult.invalidTokens : [];
  if (invalidTokens.length) {
    await disableInvalidPushTokens(invalidTokens);
  }

  return Number(pushResult?.sentCount || 0);
}

// Constant-time string comparison to prevent timing attacks
function safeCompare(a, b) {
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Admin authentication: accepts either
 *   - X-Admin-Token header matching ADMIN_TOKEN env var
 *   - Bearer JWT where the user has is_admin = 1 in the DB
 */
async function adminAuth(request) {
  // 1) Static token approach
  const staticToken = String(request.headers['x-admin-token'] || '').trim();
  if (ADMIN_TOKEN && staticToken && safeCompare(staticToken, ADMIN_TOKEN)) return { admin: true, method: 'token' };

  // 2) JWT approach – check is_admin flag on user
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const [rows] = await mysqlPool.query(
        'SELECT id, email, name, is_admin FROM users WHERE id = ? LIMIT 1',
        [Number(payload.sub)]
      );
      if (rows.length && rows[0].is_admin) {
        return { admin: true, method: 'jwt', user: rows[0] };
      }
    } catch (e) { request.log.debug({ err: e }, 'Admin JWT verify failed'); }
  }
  return null;
}

export async function registerAdminRoutes(app) {

  // Diagnostic: verifica daca ADMIN_TOKEN e setat pe server (fara a dezvălui tokenul).
  app.get('/api/admin/ping', async (_request, reply) => {
    return reply.send({
      ok: true,
      adminTokenConfigured: Boolean(ADMIN_TOKEN),
    });
  });

  // ─── Admin Login (returns success if token is valid) ───
  app.post('/api/admin/login', async (request, reply) => {
    const token = String(request.body?.token || '').trim();
    if (!token) return reply.code(400).send({ error: 'Token necesar' });
    if (!ADMIN_TOKEN) {
      return reply.code(503).send({
        error: 'ADMIN_TOKEN nu este configurat pe server. Adauga variabila ADMIN_TOKEN in mediul backend-ului.',
      });
    }
    if (safeCompare(token, ADMIN_TOKEN)) {
      return reply.send({ ok: true, method: 'token' });
    }
    return reply.code(403).send({ error: 'Token invalid' });
  });

  // ─── Dashboard stats ───
  app.get('/api/admin/stats', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      if (adminStatsCache && adminStatsCache.expiresAt > Date.now()) {
        return reply.send(adminStatsCache.value);
      }

      const [rows] = await mysqlPool.query(
        `SELECT
          (SELECT COUNT(*) FROM users) AS totalUsers,
          (SELECT COUNT(*) FROM progress_entries) AS totalEntries,
          (SELECT COUNT(*) FROM questions) AS totalQuestions,
          (SELECT COUNT(*) FROM questions WHERE status = 'new') AS newQuestions,
          (SELECT COUNT(*) FROM meetings) AS totalMeetings,
          (SELECT COUNT(*) FROM meetings WHERE scheduled_at > NOW()) AS upcomingMeetings,
          (SELECT COUNT(*) FROM webinars) AS totalWebinars,
          (SELECT COUNT(*) FROM webinars WHERE status IN ('scheduled', 'live') AND scheduled_at >= NOW()) AS upcomingWebinars,
          (SELECT COUNT(*) FROM subscriptions WHERE ends_at IS NULL OR ends_at > NOW()) AS totalSubscriptions,
          (SELECT COUNT(*) FROM bug_reports) AS totalBugReports,
          (SELECT COUNT(*) FROM bug_reports WHERE status IN ('new', 'in_progress')) AS openBugReports,
          (SELECT COUNT(*) FROM bug_reports WHERE status = 'new') AS newBugReports`
      );

      const stats = (Array.isArray(rows) && rows.length ? rows[0] : null) || {
        totalUsers: 0,
        totalEntries: 0,
        totalQuestions: 0,
        newQuestions: 0,
        totalMeetings: 0,
        upcomingMeetings: 0,
        totalWebinars: 0,
        upcomingWebinars: 0,
        totalSubscriptions: 0,
        totalBugReports: 0,
        openBugReports: 0,
        newBugReports: 0,
      };

      adminStatsCache = {
        value: stats,
        expiresAt: Date.now() + ADMIN_STATS_CACHE_TTL_MS,
      };

      return reply.send(stats);
    } catch (e) {
      request.log.error({ err: e }, 'Admin stats failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Users ───
  app.get('/api/admin/users', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = request.query.search || '';
    try {
      let rows, total;
      if (search) {
        const like = `%${search}%`;
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM users WHERE email LIKE ? OR name LIKE ?', [like, like]);
        [rows] = await mysqlPool.query(
          'SELECT id, email, name, provider, created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [like, like, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM users');
        [rows] = await mysqlPool.query(
          'SELECT id, email, name, provider, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list users failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── All Progress Entries ───
  app.get('/api/admin/progress', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const userId = request.query.user_id ? Number(request.query.user_id) : null;
    const subscriptionTypeSql = `
      COALESCE((
        SELECT
          CASE
            WHEN s.type = 'pro' THEN 'premium'
            ELSE s.type
          END
        FROM subscriptions s
        WHERE s.user_id = p.user_id
          AND s.type IN ('trial', 'basic', 'premium', 'vip', 'pro')
          AND (s.ends_at IS NULL OR s.ends_at > NOW())
        ORDER BY
          CASE WHEN s.type = 'trial' THEN 1 ELSE 0 END ASC,
          s.starts_at DESC,
          s.id DESC
        LIMIT 1
      ), 'none')
    `;
    try {
      let rows, total;
      if (userId) {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM progress_entries WHERE user_id = ?', [userId]);
        [rows] = await mysqlPool.query(
          `SELECT p.id, p.user_id, u.email, u.name AS user_name, p.level, p.description, p.actions, p.client_date, p.created_at,
                  ${subscriptionTypeSql} AS subscription_type
           FROM progress_entries p LEFT JOIN users u ON u.id = p.user_id
           WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM progress_entries');
        [rows] = await mysqlPool.query(
          `SELECT p.id, p.user_id, u.email, u.name AS user_name, p.level, p.description, p.actions, p.client_date, p.created_at,
                  ${subscriptionTypeSql} AS subscription_type
           FROM progress_entries p LEFT JOIN users u ON u.id = p.user_id
           ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── All Questions ───
  app.get('/api/admin/questions', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const status = request.query.status || '';
    try {
      let rows, total;
      if (status) {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM questions WHERE status = ?', [status]);
        [rows] = await mysqlPool.query(
          `SELECT q.id, q.user_id, u.email, u.name AS user_name, q.name, q.email AS q_email, q.question, q.consent, q.status,
                  q.admin_response, q.responded_at, q.responded_by, responder.name AS responder_name, q.created_at
           FROM questions q
           LEFT JOIN users u ON u.id = q.user_id
           LEFT JOIN users responder ON responder.id = q.responded_by
           WHERE q.status = ? ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
          [status, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM questions');
        [rows] = await mysqlPool.query(
          `SELECT q.id, q.user_id, u.email, u.name AS user_name, q.name, q.email AS q_email, q.question, q.consent, q.status,
                  q.admin_response, q.responded_at, q.responded_by, responder.name AS responder_name, q.created_at
           FROM questions q
           LEFT JOIN users u ON u.id = q.user_id
           LEFT JOIN users responder ON responder.id = q.responded_by
           ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list questions failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Update question status and/or admin response
  app.put('/api/admin/questions/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });

    const { status, admin_response: adminResponseRaw } = request.body || {};
    const valid = ['new', 'read', 'answered', 'archived'];
    if (status !== undefined && !valid.includes(status)) return reply.code(400).send({ error: 'Status invalid' });
    if (status === undefined && adminResponseRaw === undefined) {
      return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    }

    try {
      const [existingRows] = await mysqlPool.query(
        'SELECT id, user_id, status, admin_response FROM questions WHERE id = ? LIMIT 1',
        [id]
      );
      if (!Array.isArray(existingRows) || !existingRows.length) {
        return reply.code(404).send({ error: 'Intrebare inexistenta' });
      }

      const existingQuestion = existingRows[0];
      const fields = [];
      const values = [];

      if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
      }

      let normalizedResponse = null;
      let shouldNotify = false;

      if (adminResponseRaw !== undefined) {
        normalizedResponse = String(adminResponseRaw || '').trim();
        if (normalizedResponse) {
          fields.push('admin_response = ?');
          values.push(normalizedResponse);
          fields.push('responded_at = CURRENT_TIMESTAMP');
          fields.push('responded_by = ?');
          values.push(auth?.user?.id ? Number(auth.user.id) : null);
          if (status === undefined) {
            fields.push('status = ?');
            values.push('answered');
          }
          shouldNotify = normalizedResponse !== String(existingQuestion.admin_response || '').trim();
        } else {
          fields.push('admin_response = NULL');
          fields.push('responded_at = NULL');
          fields.push('responded_by = NULL');
        }
      }

      if (!fields.length) return reply.send({ ok: true, notified: 0 });

      values.push(id);
      await mysqlPool.query(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, values);
      invalidateAdminStatsCache();

      let notified = 0;
      if (shouldNotify && normalizedResponse && existingQuestion.user_id) {
        await recordNotificationSafe({
          userId: Number(existingQuestion.user_id),
          type: 'question_response',
          title: 'Dan ti-a raspuns la intrebare',
          body: 'Ai primit un raspuns nou la intrebarea ta.',
          data: { questionId: id },
          logger: request.log,
        });

        const [tokenRows] = await mysqlPool.query(
          'SELECT expo_push_token FROM user_push_tokens WHERE user_id = ? AND enabled = 1',
          [Number(existingQuestion.user_id)]
        );
        const pushTokens = (Array.isArray(tokenRows) ? tokenRows : [])
          .map((row) => row.expo_push_token)
          .filter((token) => isExpoPushToken(token));

        if (pushTokens.length) {
          const pushResult = await sendPushToExpoTokens({
            tokens: pushTokens,
            title: 'Dan ti-a raspuns la intrebare',
            body: 'Ai primit un raspuns nou la intrebarea ta.',
            data: { type: 'question_response', questionId: id },
            logger: request.log,
          });
          notified = Number(pushResult?.sentCount || 0);

          const invalidTokens = Array.isArray(pushResult?.invalidTokens) ? pushResult.invalidTokens : [];
          if (invalidTokens.length) {
            const placeholders = invalidTokens.map(() => '?').join(', ');
            await mysqlPool.query(
              `UPDATE user_push_tokens
               SET enabled = 0, updated_at = CURRENT_TIMESTAMP
               WHERE expo_push_token IN (${placeholders})`,
              invalidTokens
            );
          }
        }
      }

      return reply.send({ ok: true, notified });
    } catch (e) {
      request.log.error({ err: e }, 'Admin update question failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Meetings CRUD ───
  app.get('/api/admin/meetings', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const upcoming = request.query.upcoming === '1';
    const from = request.query.from ? new Date(request.query.from) : null;
    const to = request.query.to ? new Date(request.query.to) : null;
    if (from && isNaN(from.getTime())) return reply.code(400).send({ error: 'Parametrul from este invalid' });
    if (to && isNaN(to.getTime())) return reply.code(400).send({ error: 'Parametrul to este invalid' });
    try {
      let rows, total;
      const whereParts = [];
      const whereParams = [];
      if (upcoming) whereParts.push('m.scheduled_at > NOW()');
      if (from) {
        whereParts.push('m.scheduled_at >= ?');
        whereParams.push(from);
      }
      if (to) {
        whereParts.push('m.scheduled_at < ?');
        whereParams.push(to);
      }
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      [[{ total }]] = await mysqlPool.query(`SELECT COUNT(*) AS total FROM meetings m ${where}`, whereParams);
      [rows] = await mysqlPool.query(
        `SELECT m.id, m.user_id, u.email, u.name AS user_name, m.title, m.notes, m.scheduled_at, m.duration_min, m.status, m.created_at
         FROM meetings m LEFT JOIN users u ON u.id = m.user_id
         ${where} ORDER BY m.scheduled_at ASC LIMIT ? OFFSET ?`,
        [...whereParams, limit, offset]
      );
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list meetings failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/meetings', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { user_id, title, notes, scheduled_at, duration_min } = request.body || {};
    if (!scheduled_at) return reply.code(400).send({ error: 'Data programării este necesară' });
    const parsedScheduledAt = new Date(scheduled_at);
    if (isNaN(parsedScheduledAt.getTime())) return reply.code(400).send({ error: 'Data programării este invalidă' });
    try {
      const [res] = await mysqlPool.query(
        'INSERT INTO meetings (user_id, title, notes, scheduled_at, duration_min) VALUES (?, ?, ?, ?, ?)',
        [user_id ? Number(user_id) : null, title || 'Ședință', notes || null, parsedScheduledAt, duration_min ? Number(duration_min) : 60]
      );
      invalidateAdminStatsCache();
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Create meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/meetings/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, notes, scheduled_at, duration_min, status } = request.body || {};
    if (status !== undefined && !MEETING_STATUSES.includes(status)) {
      return reply.code(400).send({ error: 'Status întâlnire invalid' });
    }
    try {
      const [existingRows] = await mysqlPool.query(
        'SELECT id, user_id, title, notes, scheduled_at, duration_min, status FROM meetings WHERE id = ? LIMIT 1',
        [id]
      );

      if (!Array.isArray(existingRows) || !existingRows.length) {
        return reply.code(404).send({ error: 'Intalnire inexistenta' });
      }

      const existingMeeting = existingRows[0];
      const fields = [];
      const values = [];
      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
      if (scheduled_at !== undefined) {
        const parsedDate = new Date(scheduled_at);
        if (isNaN(parsedDate.getTime())) return reply.code(400).send({ error: 'Data programării este invalidă' });
        fields.push('scheduled_at = ?'); values.push(parsedDate);
      }
      if (duration_min !== undefined) { fields.push('duration_min = ?'); values.push(Number(duration_min)); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (!fields.length) return reply.code(400).send({ error: 'Niciun câmp de actualizat' });

      values.push(id);
      await mysqlPool.query(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, values);

      const [updatedRows] = await mysqlPool.query(
        'SELECT id, user_id, title, notes, scheduled_at, duration_min, status FROM meetings WHERE id = ? LIMIT 1',
        [id]
      );
      const updatedMeeting = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : existingMeeting;

      const previousScheduleTs = parseDateTimeInput(existingMeeting.scheduled_at)?.getTime() || null;
      const updatedScheduleTs = parseDateTimeInput(updatedMeeting.scheduled_at)?.getTime() || null;
      const scheduleChanged = previousScheduleTs !== updatedScheduleTs;
      const statusChanged = String(existingMeeting.status || '').trim() !== String(updatedMeeting.status || '').trim();

      let notified = 0;
      if (existingMeeting.user_id && (scheduleChanged || statusChanged)) {
        notified = await notifyUserAboutMeetingUpdate({
          request,
          meetingId: id,
          userId: existingMeeting.user_id,
          previousMeeting: existingMeeting,
          updatedMeeting,
          statusChanged,
          scheduleChanged,
        });
      }

      invalidateAdminStatsCache();
      return reply.send({ ok: true, notified });
    } catch (e) {
      request.log.error({ err: e }, 'Update meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/meetings/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM meetings WHERE id = ?', [id]);
      invalidateAdminStatsCache();
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Delete meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Webinars CRUD ───
  app.get('/api/admin/webinars', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });

    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const status = normalizeOptionalText(request.query.status);
    const upcoming = request.query.upcoming === '1';

    if (status && !WEBINAR_STATUSES.includes(status)) {
      return reply.code(400).send({ error: 'Status webinar invalid' });
    }

    try {
      const whereParts = [];
      const whereParams = [];

      if (status) {
        whereParts.push('w.status = ?');
        whereParams.push(status);
      }
      if (upcoming) {
        whereParts.push('w.scheduled_at >= NOW()');
      }

      const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      const [[{ total }]] = await mysqlPool.query(`SELECT COUNT(*) AS total FROM webinars w ${whereSql}`, whereParams);

      const [rows] = await mysqlPool.query(
        `SELECT
          w.id,
          w.title,
          w.description,
          w.scheduled_at,
          w.access_link,
          w.status,
          w.recording_link,
          w.created_by,
          w.updated_by,
          w.created_at,
          w.updated_at,
          creator.name AS created_by_name,
          updater.name AS updated_by_name
         FROM webinars w
         LEFT JOIN users creator ON creator.id = w.created_by
         LEFT JOIN users updater ON updater.id = w.updated_by
         ${whereSql}
         ORDER BY w.scheduled_at DESC, w.id DESC
         LIMIT ? OFFSET ?`,
        [...whereParams, limit, offset]
      );

      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list webinars failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/webinars', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });

    const {
      title,
      description,
      scheduled_at,
      access_link,
      status = 'scheduled',
      recording_link,
    } = request.body || {};

    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) return reply.code(400).send({ error: 'Titlul webinarului este necesar' });

    const parsedScheduledAt = parseDateTimeInput(scheduled_at);
    if (!parsedScheduledAt) return reply.code(400).send({ error: 'Data webinarului este invalida' });

    const normalizedStatus = String(status || 'scheduled').trim();
    if (!WEBINAR_STATUSES.includes(normalizedStatus)) {
      return reply.code(400).send({ error: 'Status webinar invalid' });
    }

    const normalizedDescription = normalizeOptionalText(description);
    const normalizedAccessLink = normalizeOptionalText(access_link);
    const normalizedRecordingLink = normalizeOptionalText(recording_link);
    const adminUserId = auth?.user?.id ? Number(auth.user.id) : null;

    try {
      const [insertResult] = await mysqlPool.query(
        `INSERT INTO webinars (
          title,
          description,
          scheduled_at,
          access_link,
          status,
          recording_link,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedTitle,
          normalizedDescription,
          parsedScheduledAt,
          normalizedAccessLink,
          normalizedStatus,
          normalizedRecordingLink,
          adminUserId,
          adminUserId,
        ]
      );

      const webinarId = Number(insertResult?.insertId);
      const notified = await notifyPremiumVipUsersAboutWebinar({
        request,
        webinarId,
        webinar: {
          title: normalizedTitle,
          scheduled_at: parsedScheduledAt,
          status: normalizedStatus,
          recording_link: normalizedRecordingLink,
        },
        type: 'webinar_created',
      });

      invalidateAdminStatsCache();
      return reply.send({ id: webinarId, notified });
    } catch (e) {
      request.log.error({ err: e }, 'Create webinar failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/webinars/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });

    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });

    const {
      title,
      description,
      scheduled_at,
      access_link,
      status,
      recording_link,
    } = request.body || {};

    const fields = [];
    const values = [];
    const changedImportantFieldNames = new Set();

    try {
      const [existingRows] = await mysqlPool.query(
        `SELECT id, title, description, scheduled_at, access_link, status, recording_link
         FROM webinars
         WHERE id = ?
         LIMIT 1`,
        [id]
      );

      if (!Array.isArray(existingRows) || !existingRows.length) {
        return reply.code(404).send({ error: 'Webinar inexistent' });
      }

      const existing = existingRows[0];

      if (title !== undefined) {
        const normalizedTitle = String(title || '').trim();
        if (!normalizedTitle) return reply.code(400).send({ error: 'Titlul webinarului este necesar' });
        fields.push('title = ?');
        values.push(normalizedTitle);
        if (normalizedTitle !== String(existing.title || '').trim()) changedImportantFieldNames.add('title');
      }

      if (description !== undefined) {
        const normalizedDescription = normalizeOptionalText(description);
        fields.push('description = ?');
        values.push(normalizedDescription);
      }

      if (scheduled_at !== undefined) {
        const parsedScheduledAt = parseDateTimeInput(scheduled_at);
        if (!parsedScheduledAt) return reply.code(400).send({ error: 'Data webinarului este invalida' });
        fields.push('scheduled_at = ?');
        values.push(parsedScheduledAt);

        const existingTimestamp = parseDateTimeInput(existing.scheduled_at)?.getTime() || 0;
        if (existingTimestamp !== parsedScheduledAt.getTime()) changedImportantFieldNames.add('scheduled_at');
      }

      if (access_link !== undefined) {
        const normalizedAccessLink = normalizeOptionalText(access_link);
        fields.push('access_link = ?');
        values.push(normalizedAccessLink);
        if (normalizedAccessLink !== normalizeOptionalText(existing.access_link)) changedImportantFieldNames.add('access_link');
      }

      if (status !== undefined) {
        const normalizedStatus = String(status || '').trim();
        if (!WEBINAR_STATUSES.includes(normalizedStatus)) {
          return reply.code(400).send({ error: 'Status webinar invalid' });
        }
        fields.push('status = ?');
        values.push(normalizedStatus);
        if (normalizedStatus !== String(existing.status || '').trim()) changedImportantFieldNames.add('status');
      }

      if (recording_link !== undefined) {
        const normalizedRecordingLink = normalizeOptionalText(recording_link);
        fields.push('recording_link = ?');
        values.push(normalizedRecordingLink);
        if (normalizedRecordingLink !== normalizeOptionalText(existing.recording_link)) changedImportantFieldNames.add('recording_link');
      }

      const adminUserId = auth?.user?.id ? Number(auth.user.id) : null;
      fields.push('updated_by = ?');
      values.push(adminUserId);

      if (fields.length === 1) {
        return reply.code(400).send({ error: 'Niciun camp de actualizat' });
      }

      values.push(id);
      await mysqlPool.query(`UPDATE webinars SET ${fields.join(', ')} WHERE id = ?`, values);

      const [updatedRows] = await mysqlPool.query(
        'SELECT id, title, scheduled_at, status, recording_link FROM webinars WHERE id = ? LIMIT 1',
        [id]
      );
      const updated = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : existing;

      let notified = 0;
      if (changedImportantFieldNames.size > 0) {
        const statusChangedToHeld =
          changedImportantFieldNames.has('status') &&
          String(updated?.status || '').toLowerCase() === 'held';

        notified = await notifyPremiumVipUsersAboutWebinar({
          request,
          webinarId: id,
          webinar: updated,
          type: 'webinar_updated',
          bodyOverride: statusChangedToHeld ? buildWebinarHeldFinishedBody(updated) : null,
        });
      }

      invalidateAdminStatsCache();
      return reply.send({ ok: true, notified });
    } catch (e) {
      request.log.error({ err: e }, 'Update webinar failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/webinars/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });

    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });

    try {
      const [result] = await mysqlPool.query('DELETE FROM webinars WHERE id = ?', [id]);
      if (!result?.affectedRows) {
        return reply.code(404).send({ error: 'Webinar inexistent' });
      }
      invalidateAdminStatsCache();
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Delete webinar failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Bug Reports ───
  app.get('/api/admin/bug-reports', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const page = Math.max(1, Number(request.query?.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(request.query?.limit) || 50));
      const offset = (page - 1) * limit;

      const [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM bug_reports');
      const [rows] = await mysqlPool.query(
        `SELECT b.id, b.user_id, b.user_email, b.contact_email, b.description, b.status, b.created_at
         FROM bug_reports b
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list bug reports failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/bug-reports/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });

    const { status } = request.body || {};
    const validStatuses = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Status invalid' });
    }

    try {
      const [result] = await mysqlPool.query(
        'UPDATE bug_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );
      if (!result?.affectedRows) {
        return reply.code(404).send({ error: 'Bug report inexistent' });
      }
      invalidateAdminStatsCache();
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin update bug report failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Delete progress entry (admin)
  app.delete('/api/admin/progress/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM progress_entries WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Delete progress entry failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Announcements ───
  app.post('/api/admin/announcements', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });

    const { title, body, target } = request.body || {};
    const normalizedTitle = String(title || '').trim();
    const normalizedBody = String(body || '').trim();
    const normalizedTarget = String(target || '').toLowerCase();

    if (!normalizedTitle) return reply.code(400).send({ error: 'Titlul anuntului este necesar' });
    if (!normalizedBody) return reply.code(400).send({ error: 'Mesajul anuntului este necesar' });
    if (normalizedTitle.length > 100) return reply.code(400).send({ error: 'Titlul este prea lung (maxim 100 caractere)' });
    if (normalizedBody.length > 500) return reply.code(400).send({ error: 'Mesajul este prea lung (maxim 500 caractere)' });

    try {
      // Anuntul e salvat mai intai in feed, ca sa fie regasit in sectiunea
      // "Notificari" din aplicatie chiar daca push-ul nu ajunge pe telefon.
      const notificationId = await recordNotificationSafe({
        audience: normalizedTarget === 'premium' ? 'premium' : 'all',
        type: 'announcement',
        title: normalizedTitle,
        body: normalizedBody,
        logger: request.log,
      });

      let tokenRows;
      if (normalizedTarget === 'premium') {
        [tokenRows] = await mysqlPool.query(
          `SELECT DISTINCT upt.expo_push_token
           FROM user_push_tokens upt
           INNER JOIN subscriptions s ON s.user_id = upt.user_id
           WHERE upt.enabled = 1
             AND s.type IN ('premium', 'vip', 'pro')
             AND (s.ends_at IS NULL OR s.ends_at > NOW())`
        );
      } else {
        [tokenRows] = await mysqlPool.query(
          'SELECT DISTINCT expo_push_token FROM user_push_tokens WHERE enabled = 1'
        );
      }

      const pushTokens = (Array.isArray(tokenRows) ? tokenRows : [])
        .map((row) => row.expo_push_token)
        .filter((token) => isExpoPushToken(token));

      if (!pushTokens.length) {
        return reply.send({ sentCount: 0, totalTokens: 0, notificationId });
      }

      const pushResult = await sendPushToExpoTokens({
        tokens: pushTokens,
        title: normalizedTitle,
        body: normalizedBody,
        data: { type: 'announcement', notificationId },
        logger: request.log,
      });

      const invalidTokens = Array.isArray(pushResult?.invalidTokens) ? pushResult.invalidTokens : [];
      if (invalidTokens.length) {
        await disableInvalidPushTokens(invalidTokens);
      }

      return reply.send({
        sentCount: Number(pushResult?.sentCount || 0),
        totalTokens: pushTokens.length,
        notificationId,
      });
    } catch (e) {
      request.log.error({ err: e }, 'Send announcement failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

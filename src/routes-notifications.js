import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';
import { isExpoPushToken } from './push.js';
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markNotificationsRead,
} from './notifications-feed.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');

function authMiddleware(request) {
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

function normalizePlatform(value) {
  const platform = String(value || '').toLowerCase();
  if (platform === 'ios' || platform === 'android') return platform;
  return 'unknown';
}

export async function registerNotificationRoutes(app) {
  app.post('/api/notifications/push-token', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    const rawToken = request.body?.token || request.body?.expo_push_token || request.body?.pushToken;
    const token = String(rawToken || '').trim();
    if (!isExpoPushToken(token)) {
      return reply.code(400).send({ error: 'Token push invalid' });
    }

    const platform = normalizePlatform(request.body?.platform);
    const enabled = request.body?.enabled === false ? 0 : 1;

    try {
      await mysqlPool.query(
        `INSERT INTO user_push_tokens (user_id, expo_push_token, platform, enabled)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           platform = VALUES(platform),
           enabled = VALUES(enabled),
           updated_at = CURRENT_TIMESTAMP`,
        [Number(user.sub), token, platform, enabled]
      );
      return reply.send({ ok: true });
    } catch (error) {
      request.log.error({ err: error }, 'Register push token failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/notifications/push-token', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    const rawToken = request.body?.token || request.body?.expo_push_token || request.body?.pushToken;
    const token = String(rawToken || '').trim();

    try {
      let result;
      if (token) {
        if (!isExpoPushToken(token)) {
          return reply.code(400).send({ error: 'Token push invalid' });
        }
        [result] = await mysqlPool.query(
          'UPDATE user_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND expo_push_token = ?',
          [Number(user.sub), token]
        );
      } else {
        [result] = await mysqlPool.query(
          'UPDATE user_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [Number(user.sub)]
        );
      }

      return reply.send({ ok: true, affected: Number(result?.affectedRows || 0) });
    } catch (error) {
      request.log.error({ err: error }, 'Disable push token failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.get('/api/notifications/preferences', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    try {
      const [rows] = await mysqlPool.query(
        'SELECT chat_push, social_push FROM user_notification_prefs WHERE user_id = ? LIMIT 1',
        [Number(user.sub)]
      );
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      return reply.send({
        chatPush: row ? Boolean(Number(row.chat_push)) : true,
        socialPush: row ? Boolean(Number(row.social_push)) : true,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Get notification preferences failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/notifications/preferences', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    // Each preference is optional so older app versions (chatPush only) keep working.
    const { chatPush, socialPush } = request.body || {};
    if ((chatPush !== undefined && typeof chatPush !== 'boolean') ||
        (socialPush !== undefined && typeof socialPush !== 'boolean') ||
        (chatPush === undefined && socialPush === undefined)) {
      return reply.code(400).send({ error: 'Preferință de notificare invalidă.' });
    }

    try {
      await mysqlPool.query(
        `INSERT INTO user_notification_prefs (user_id, chat_push, social_push)
         VALUES (?, COALESCE(?, 1), COALESCE(?, 1))
         ON DUPLICATE KEY UPDATE chat_push = COALESCE(?, chat_push), social_push = COALESCE(?, social_push)`,
        [
          Number(user.sub),
          chatPush === undefined ? null : Number(chatPush),
          socialPush === undefined ? null : Number(socialPush),
          chatPush === undefined ? null : Number(chatPush),
          socialPush === undefined ? null : Number(socialPush),
        ]
      );
      const [[row]] = await mysqlPool.query(
        'SELECT chat_push, social_push FROM user_notification_prefs WHERE user_id = ?',
        [Number(user.sub)]
      );
      return reply.send({ chatPush: Boolean(Number(row.chat_push)), socialPush: Boolean(Number(row.social_push)) });
    } catch (error) {
      request.log.error({ err: error }, 'Update notification preferences failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Feed notificari / anunturi ───
  app.get('/api/notifications', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    const rawBefore = request.query?.before;
    const before = rawBefore === undefined || rawBefore === null || rawBefore === ''
      ? null
      : Number(rawBefore);
    if (before !== null && (!Number.isFinite(before) || before <= 0)) {
      return reply.code(400).send({ error: 'Parametrul before este invalid.' });
    }

    try {
      const feed = await listNotificationsForUser(Number(user.sub), { before });
      return reply.send(feed);
    } catch (error) {
      request.log.error({ err: error }, 'List notifications failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.get('/api/notifications/unread-count', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    try {
      const unreadCount = await countUnreadNotifications(Number(user.sub));
      return reply.send({ unreadCount });
    } catch (error) {
      request.log.error({ err: error }, 'Unread notifications count failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/notifications/read', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    const rawIds = request.body?.ids;
    const ids = Array.isArray(rawIds) ? rawIds : null;

    try {
      await markNotificationsRead(Number(user.sub), ids);
      const unreadCount = await countUnreadNotifications(Number(user.sub));
      return reply.send({ ok: true, unreadCount });
    } catch (error) {
      request.log.error({ err: error }, 'Mark notifications as read failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

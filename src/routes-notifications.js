import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';
import { isExpoPushToken } from './push.js';

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
}

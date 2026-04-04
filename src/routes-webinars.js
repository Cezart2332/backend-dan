import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');

function authMiddleware(request) {
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function normalizeLink(value) {
  const next = String(value || '').trim();
  return next.length ? next : null;
}

function buildEffectiveLink(row) {
  const status = String(row?.status || '').toLowerCase();
  const accessLink = normalizeLink(row?.access_link);
  const recordingLink = normalizeLink(row?.recording_link);

  if (status === 'held' && recordingLink) {
    return { effective_link: recordingLink, effective_link_type: 'recording' };
  }

  if ((status === 'scheduled' || status === 'live') && accessLink) {
    return { effective_link: accessLink, effective_link_type: 'join' };
  }

  return { effective_link: null, effective_link_type: null };
}

async function hasWebinarAccess(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT id
     FROM subscriptions
     WHERE user_id = ?
       AND type IN ('premium', 'vip', 'pro')
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [Number(userId)]
  );

  return Array.isArray(rows) && rows.length > 0;
}

export async function registerWebinarRoutes(app) {
  app.get('/api/webinars', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    try {
      const allowed = await hasWebinarAccess(user.sub);
      if (!allowed) {
        return reply.code(403).send({
          error: 'Acces disponibil doar utilizatorilor Premium si VIP.',
          code: 'WEBINAR_SUBSCRIPTION_REQUIRED',
        });
      }

      const [rows] = await mysqlPool.query(
        `SELECT
          id,
          title,
          description,
          scheduled_at,
          access_link,
          status,
          recording_link,
          created_at,
          updated_at
         FROM webinars
         ORDER BY
           CASE WHEN status IN ('live', 'scheduled') THEN 0 ELSE 1 END,
           scheduled_at ASC,
           id DESC`
      );

      const nowMs = Date.now();
      const items = (Array.isArray(rows) ? rows : []).map((row) => {
        const effective = buildEffectiveLink(row);
        const scheduledAt = row?.scheduled_at ? new Date(row.scheduled_at) : null;
        const scheduledAtMs = scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt.getTime() : null;

        return {
          id: Number(row.id),
          title: row.title,
          description: row.description || null,
          scheduled_at: row.scheduled_at,
          access_link: normalizeLink(row.access_link),
          status: row.status,
          recording_link: normalizeLink(row.recording_link),
          effective_link: effective.effective_link,
          effective_link_type: effective.effective_link_type,
          can_join: effective.effective_link_type === 'join',
          can_watch_recording: effective.effective_link_type === 'recording',
          is_upcoming: typeof scheduledAtMs === 'number' ? scheduledAtMs > nowMs : false,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      return reply.send({ items });
    } catch (error) {
      request.log.error({ err: error }, 'List webinars failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

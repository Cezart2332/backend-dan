import { mysqlPool } from './mysql.js';
import { requireAuth } from './request-auth.js';

function requireUser(request, reply) {
  try {
    return requireAuth(request);
  } catch {
    reply.code(401).send({ error: 'Neautorizat' });
    return null;
  }
}

export async function registerMeetingRoutes(app) {
  // Create a meeting request for the authenticated user
  app.post('/api/meetings', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const { title, notes, scheduled_at, duration_min } = request.body || {};
    if (!scheduled_at) return reply.code(400).send({ error: 'Data programării este necesară' });

    const parsedDate = new Date(scheduled_at);
    if (isNaN(parsedDate.getTime())) return reply.code(400).send({ error: 'Data programării este invalidă' });
    if (parsedDate <= new Date()) return reply.code(400).send({ error: 'Alege o dată în viitor' });

    const duration = Number(duration_min || 60);
    if (Number.isNaN(duration) || duration < 15 || duration > 180) {
      return reply.code(400).send({ error: 'Durata trebuie să fie între 15 și 180 de minute' });
    }

    try {
      const [res] = await mysqlPool.query(
        'INSERT INTO meetings (user_id, title, notes, scheduled_at, duration_min, status) VALUES (?, ?, ?, ?, ?, ?)',
        [Number(user.sub), title || 'Ședință cu Dan', notes || null, parsedDate, duration, 'scheduled']
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Create meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // List authenticated user's meetings
  app.get('/api/meetings', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const page = Math.max(1, Number(request.query?.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(request.query?.limit) || 50));
      const offset = (page - 1) * limit;
      const [rows] = await mysqlPool.query(
        'SELECT id, title, notes, scheduled_at, duration_min, status, created_at FROM meetings WHERE user_id = ? ORDER BY scheduled_at DESC LIMIT ? OFFSET ?',
        [Number(user.sub), limit + 1, offset]
      );
      const hasMore = Array.isArray(rows) && rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return reply.send({ items, page, limit, hasMore });
    } catch (e) {
      request.log.error({ err: e }, 'List meetings failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

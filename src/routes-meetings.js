import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';

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

export async function registerMeetingRoutes(app) {
  // Create a meeting request for the authenticated user
  app.post('/api/meetings', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

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
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, title, notes, scheduled_at, duration_min, status, created_at FROM meetings WHERE user_id = ? ORDER BY scheduled_at DESC LIMIT 200',
        [Number(user.sub)]
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'List meetings failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

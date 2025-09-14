import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || 'dev_change_me';

function authMiddleware(request) {
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload; // { sub, email, name }
  } catch {
    return null;
  }
}

export async function registerChallengeRoutes(app) {
  // Create a challenge run
  app.post('/api/challenges/run', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    const { challenge_id, difficulty, notes, date } = request.body || {};
    if (!challenge_id || typeof challenge_id !== 'string') return reply.code(400).send({ error: 'ID provocare lipsă' });
    try {
      const clientDate = date ? new Date(date) : null;
      const diff = difficulty !== undefined && difficulty !== null ? Number(difficulty) : null;
      const [res] = await mysqlPool.query(
        'INSERT INTO challenge_runs (user_id, challenge_id, difficulty, notes, client_date) VALUES (?, ?, ?, ?, ?)',
        [Number(user.sub), challenge_id, diff, notes || null, clientDate]
      );
      const id = res.insertId;
      return reply.send({ id });
    } catch (e) {
      request.log.error({ err: e }, 'Create challenge run failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // List challenge runs (newest first)
  app.get('/api/challenges/run', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, challenge_id, difficulty, notes, client_date, created_at FROM challenge_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 500',
        [Number(user.sub)]
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'List challenge runs failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Get one run
  app.get('/api/challenges/run/:id', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    const id = Number(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID invalid' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, challenge_id, difficulty, notes, client_date, created_at FROM challenge_runs WHERE id = ? AND user_id = ? LIMIT 1',
        [id, Number(user.sub)]
      );
      if (!Array.isArray(rows) || rows.length === 0) return reply.code(404).send({ error: 'Nu a fost găsit' });
      return reply.send(rows[0]);
    } catch (e) {
      request.log.error({ err: e }, 'Get challenge run failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

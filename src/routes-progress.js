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

export async function registerProgressRoutes(app) {
  // Create a progress entry
  app.post('/api/progress', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    const { level, description, actions, date } = request.body || {};
    if (!level || isNaN(Number(level))) return reply.code(400).send({ error: 'Nivel invalid' });
    try {
      const clientDate = date ? new Date(date) : null;
      const [res] = await mysqlPool.query(
        'INSERT INTO progress_entries (user_id, level, description, actions, client_date) VALUES (?, ?, ?, ?, ?)',
        [Number(user.sub), Number(level), description || null, actions || null, clientDate]
      );
      const id = res.insertId;
      return reply.send({ id });
    } catch (e) {
      request.log.error({ err: e }, 'Create progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // List progress entries (newest first)
  app.get('/api/progress', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, level, description, actions, client_date, created_at FROM progress_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 500',
        [Number(user.sub)]
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'List progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Get one entry
  app.get('/api/progress/:id', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    const id = Number(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID invalid' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, level, description, actions, client_date, created_at FROM progress_entries WHERE id = ? AND user_id = ? LIMIT 1',
        [id, Number(user.sub)]
      );
      if (!Array.isArray(rows) || rows.length === 0) return reply.code(404).send({ error: 'Nu a fost găsit' });
      return reply.send(rows[0]);
    } catch (e) {
      request.log.error({ err: e }, 'Get progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

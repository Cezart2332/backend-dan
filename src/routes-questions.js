import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || 'dev_change_me';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.CORE_ADMIN_TOKEN || null;

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

export async function registerQuestionRoutes(app) {
  // Create a question (optionally authenticated)
  app.post('/api/questions', async (request, reply) => {
    const user = authMiddleware(request);
    const { name, email, question, consent } = request.body || {};
    if (!question || !String(question).trim()) return reply.code(400).send({ error: 'Întrebare lipsă' });
    const consentVal = consent ? 1 : 0;
    try {
      const [res] = await mysqlPool.query(
        'INSERT INTO questions (user_id, name, email, question, consent) VALUES (?, ?, ?, ?, ?)',
        [user ? Number(user.sub) : null, name || null, email || null, String(question).trim(), consentVal]
      );
      const id = res.insertId;
      return reply.send({ id });
    } catch (e) {
      request.log.error({ err: e }, 'Create question failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // List my questions (requires auth)
  app.get('/api/questions', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, name, email, question, consent, status, created_at FROM questions WHERE user_id = ? ORDER BY created_at DESC LIMIT 500',
        [Number(user.sub)]
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'List my questions failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Admin list all (optional helper, protect via static ADMIN_TOKEN header X-Admin-Token)
  app.get('/api/admin/questions', async (request, reply) => {
    const token = request.headers['x-admin-token'];
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, user_id, name, email, question, consent, status, created_at FROM questions ORDER BY created_at DESC LIMIT 1000'
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list questions failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

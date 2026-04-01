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
      const page = Math.max(1, Number(request.query?.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(request.query?.limit) || 50));
      const offset = (page - 1) * limit;
      const [rows] = await mysqlPool.query(
        'SELECT id, name, email, question, consent, status, admin_response, responded_at, created_at FROM questions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [Number(user.sub), limit + 1, offset]
      );
      const hasMore = Array.isArray(rows) && rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return reply.send({ items, page, limit, hasMore });
    } catch (e) {
      request.log.error({ err: e }, 'List my questions failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

}

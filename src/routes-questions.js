import { mysqlPool } from './mysql.js';
import { optionalAuth, requireAuth } from './request-auth.js';

function requireUser(request, reply) {
  try {
    return requireAuth(request);
  } catch {
    reply.code(401).send({ error: 'Neautorizat' });
    return null;
  }
}

export async function registerQuestionRoutes(app) {
  // Create a question (optionally authenticated)
  app.post('/api/questions', async (request, reply) => {
    const user = optionalAuth(request);
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
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const page = Math.max(1, Number(request.query?.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(request.query?.limit) || 50));
      const offset = (page - 1) * limit;
      const [rows] = await mysqlPool.query(
        'SELECT id, name, email, question, consent, status, created_at FROM questions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
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

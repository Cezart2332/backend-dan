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

export async function registerProgressRoutes(app) {
  // Create a progress entry
  app.post('/api/progress', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
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
    const user = requireUser(request, reply);
    if (!user) return;
    try {
      const page = Math.max(1, Number(request.query?.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(request.query?.limit) || 50));
      const offset = (page - 1) * limit;
      const [rows] = await mysqlPool.query(
        'SELECT id, level, description, actions, client_date, created_at FROM progress_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [Number(user.sub), limit + 1, offset]
      );
      const hasMore = Array.isArray(rows) && rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return reply.send({ items, page, limit, hasMore });
    } catch (e) {
      request.log.error({ err: e }, 'List progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Get one entry
  app.get('/api/progress/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
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

  // One-time cleanup: delete mock/seed progress entries that were accidentally synced
  app.delete('/api/progress/cleanup-mock', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const mockDescriptions = [
      'Am simțit presiune la muncă dar am respirat 4-7-8.',
      'Zi liniștită, am meditat dimineața.',
      'Am avut anxietate înainte de o prezentare.',
    ];
    try {
      const [result] = await mysqlPool.query(
        'DELETE FROM progress_entries WHERE user_id = ? AND description IN (?, ?, ?)',
        [Number(user.sub), ...mockDescriptions]
      );
      return reply.send({ deleted: result.affectedRows });
    } catch (e) {
      request.log.error({ err: e }, 'Cleanup mock entries failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

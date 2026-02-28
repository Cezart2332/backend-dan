import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.CORE_ADMIN_TOKEN || null;

/**
 * Admin authentication: accepts either
 *   - X-Admin-Token header matching ADMIN_TOKEN env var
 *   - Bearer JWT where the user has is_admin = 1 in the DB
 */
async function adminAuth(request) {
  // 1) Static token approach
  const staticToken = request.headers['x-admin-token'];
  if (ADMIN_TOKEN && staticToken === ADMIN_TOKEN) return { admin: true, method: 'token' };

  // 2) JWT approach – check is_admin flag on user
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const [rows] = await mysqlPool.query(
        'SELECT id, email, name, is_admin FROM users WHERE id = ? LIMIT 1',
        [Number(payload.sub)]
      );
      if (rows.length && rows[0].is_admin) {
        return { admin: true, method: 'jwt', user: rows[0] };
      }
    } catch {}
  }
  return null;
}

export async function registerAdminRoutes(app) {

  // ─── Admin Login (returns success if token is valid) ───
  app.post('/api/admin/login', async (request, reply) => {
    const { token } = request.body || {};
    if (!token) return reply.code(400).send({ error: 'Token necesar' });
    if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
      return reply.send({ ok: true, method: 'token' });
    }
    return reply.code(403).send({ error: 'Token invalid' });
  });

  // ─── Dashboard stats ───
  app.get('/api/admin/stats', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const [[{ totalUsers }]] = await mysqlPool.query('SELECT COUNT(*) AS totalUsers FROM users');
      const [[{ totalEntries }]] = await mysqlPool.query('SELECT COUNT(*) AS totalEntries FROM progress_entries');
      const [[{ totalQuestions }]] = await mysqlPool.query('SELECT COUNT(*) AS totalQuestions FROM questions');
      const [[{ newQuestions }]] = await mysqlPool.query("SELECT COUNT(*) AS newQuestions FROM questions WHERE status = 'new'");
      let totalMeetings = 0;
      let upcomingMeetings = 0;
      try {
        const [[m1]] = await mysqlPool.query('SELECT COUNT(*) AS c FROM meetings');
        const [[m2]] = await mysqlPool.query('SELECT COUNT(*) AS c FROM meetings WHERE scheduled_at > NOW()');
        totalMeetings = m1.c;
        upcomingMeetings = m2.c;
      } catch {}
      const [[{ totalSubscriptions }]] = await mysqlPool.query("SELECT COUNT(*) AS totalSubscriptions FROM subscriptions WHERE ends_at IS NULL OR ends_at > NOW()");
      return reply.send({ totalUsers, totalEntries, totalQuestions, newQuestions, totalMeetings, upcomingMeetings, totalSubscriptions });
    } catch (e) {
      request.log.error({ err: e }, 'Admin stats failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Users ───
  app.get('/api/admin/users', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = request.query.search || '';
    try {
      let rows, total;
      if (search) {
        const like = `%${search}%`;
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM users WHERE email LIKE ? OR name LIKE ?', [like, like]);
        [rows] = await mysqlPool.query(
          'SELECT id, email, name, provider, created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [like, like, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM users');
        [rows] = await mysqlPool.query(
          'SELECT id, email, name, provider, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list users failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── All Progress Entries ───
  app.get('/api/admin/progress', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const userId = request.query.user_id ? Number(request.query.user_id) : null;
    try {
      let rows, total;
      if (userId) {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM progress_entries WHERE user_id = ?', [userId]);
        [rows] = await mysqlPool.query(
          `SELECT p.id, p.user_id, u.email, u.name AS user_name, p.level, p.description, p.actions, p.client_date, p.created_at
           FROM progress_entries p LEFT JOIN users u ON u.id = p.user_id
           WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM progress_entries');
        [rows] = await mysqlPool.query(
          `SELECT p.id, p.user_id, u.email, u.name AS user_name, p.level, p.description, p.actions, p.client_date, p.created_at
           FROM progress_entries p LEFT JOIN users u ON u.id = p.user_id
           ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list progress failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── All Questions ───
  app.get('/api/admin/questions', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const status = request.query.status || '';
    try {
      let rows, total;
      if (status) {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM questions WHERE status = ?', [status]);
        [rows] = await mysqlPool.query(
          `SELECT q.id, q.user_id, u.email, u.name AS user_name, q.name, q.email AS q_email, q.question, q.consent, q.status, q.created_at
           FROM questions q LEFT JOIN users u ON u.id = q.user_id
           WHERE q.status = ? ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
          [status, limit, offset]
        );
      } else {
        [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM questions');
        [rows] = await mysqlPool.query(
          `SELECT q.id, q.user_id, u.email, u.name AS user_name, q.name, q.email AS q_email, q.question, q.consent, q.status, q.created_at
           FROM questions q LEFT JOIN users u ON u.id = q.user_id
           ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list questions failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Update question status
  app.put('/api/admin/questions/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    const { status } = request.body || {};
    const valid = ['new', 'read', 'answered', 'archived'];
    if (!valid.includes(status)) return reply.code(400).send({ error: 'Status invalid' });
    try {
      await mysqlPool.query('UPDATE questions SET status = ? WHERE id = ?', [status, id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin update question failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Meetings CRUD ───
  app.get('/api/admin/meetings', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const upcoming = request.query.upcoming === '1';
    try {
      let rows, total;
      const where = upcoming ? 'WHERE m.scheduled_at > NOW()' : '';
      [[{ total }]] = await mysqlPool.query(`SELECT COUNT(*) AS total FROM meetings m ${where}`);
      [rows] = await mysqlPool.query(
        `SELECT m.id, m.user_id, u.email, u.name AS user_name, m.title, m.notes, m.scheduled_at, m.duration_min, m.status, m.created_at
         FROM meetings m LEFT JOIN users u ON u.id = m.user_id
         ${where} ORDER BY m.scheduled_at ASC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return reply.send({ items: rows, total, page, limit });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list meetings failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/meetings', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { user_id, title, notes, scheduled_at, duration_min } = request.body || {};
    if (!scheduled_at) return reply.code(400).send({ error: 'Data programării este necesară' });
    try {
      const [res] = await mysqlPool.query(
        'INSERT INTO meetings (user_id, title, notes, scheduled_at, duration_min) VALUES (?, ?, ?, ?, ?)',
        [user_id ? Number(user_id) : null, title || 'Ședință', notes || null, new Date(scheduled_at), duration_min ? Number(duration_min) : 60]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Create meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/meetings/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    const { title, notes, scheduled_at, duration_min, status } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (scheduled_at !== undefined) { fields.push('scheduled_at = ?'); values.push(new Date(scheduled_at)); }
    if (duration_min !== undefined) { fields.push('duration_min = ?'); values.push(Number(duration_min)); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun câmp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Update meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/meetings/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM meetings WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Delete meeting failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Bug Reports ───
  app.get('/api/admin/bug-reports', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const [rows] = await mysqlPool.query(
        `SELECT b.id, b.user_id, b.user_email, b.contact_email, b.description, b.status, b.created_at
         FROM bug_reports b ORDER BY b.created_at DESC LIMIT 500`
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin list bug reports failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Delete progress entry (admin)
  app.delete('/api/admin/progress/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM progress_entries WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Delete progress entry failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}

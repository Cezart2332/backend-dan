import jwt from 'jsonwebtoken';

const CONTEXTS = ['home', 'work', 'travel', 'social', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = { checkins: 'wellbeing_checkins', sessions: 'wellbeing_sessions' };

export async function migrateWellbeing(pool) {
  for (const table of Object.values(TABLES)) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      client_id CHAR(36) NOT NULL,
      occurred_at DATETIME(3) NOT NULL,
      payload JSON NOT NULL,
      revision INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_${table}_client (user_id, client_id),
      INDEX idx_${table}_date (user_id, occurred_at, id),
      CONSTRAINT fk_${table}_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  }
}

function choice(value, allowed, label, optional = true) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  if (!allowed.includes(value)) throw new Error(`${label} invalid.`);
  return value;
}
function level(value, optional = false) {
  if (value === null || value === undefined) {
    if (optional) return null;
    throw new Error('Nivel lipsă.');
  }
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Nivel invalid.');
  return value;
}
export function validateFeedback(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Feedback invalid.');
  return { rating: choice(value.rating, ['helpful', 'neutral', 'unhelpful'], 'Feedback'), level: level(value.level, true), context: choice(value.context, CONTEXTS, 'Context') };
}
export function validateRecord(kind, value) {
  if (!value || typeof value !== 'object' || !UUID.test(value.clientId)) throw new Error('Identificator invalid.');
  if (typeof value.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.occurredAt) || !Number.isFinite(Date.parse(value.occurredAt))) throw new Error('Dată invalidă.');
  if (new Date(value.occurredAt).getUTCFullYear() < 1000) throw new Error('Dată invalidă.');
  if (!Number.isInteger(value.timezoneOffset) || Math.abs(value.timezoneOffset) > 840) throw new Error('Fus orar invalid.');
  if (typeof value.timezone !== 'string' || value.timezone.length > 100) throw new Error('Fus orar invalid.');
  const common = { clientId: value.clientId.toLowerCase(), occurredAt: new Date(value.occurredAt).toISOString(), timezoneOffset: value.timezoneOffset, timezone: value.timezone };
  if (kind === 'checkins') {
    if (value.note != null && (typeof value.note !== 'string' || value.note.length > 4000)) throw new Error('Notiță prea lungă.');
    return { ...common, level: level(value.level), note: value.note?.trim() || '', context: choice(value.context, CONTEXTS, 'Context'), sleep: choice(value.sleep, ['poor', 'average', 'good'], 'Somn'), caffeine: choice(value.caffeine, ['none', 'some', 'much'], 'Cafeină'), activity: choice(value.activity, ['rest', 'walk', 'exercise', 'work', 'social', 'other'], 'Activitate') };
  }
  if (!Number.isInteger(value.duration) || ![120, 180, 300].includes(value.duration)) throw new Error('Durată invalidă.');
  if (!Number.isInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > value.duration * 1000) throw new Error('Timp invalid.');
  if (!Array.isArray(value.techniques) || !value.techniques.length || value.techniques.length > 2 || value.techniques.some((t) => !['breathing', 'grounding'].includes(t))) throw new Error('Tehnică invalidă.');
  return { ...common, duration: value.duration, elapsedMs: value.elapsedMs, pattern: choice(value.pattern, ['4-6', '4-2-6'], 'Ritm', false), status: choice(value.status, ['completed', 'stopped'], 'Stare', false), techniques: [...new Set(value.techniques)], feedback: validateFeedback(value.feedback) };
}

function parsePage(query = {}) {
  const page = Number(query.page || 1), limit = Number(query.limit || 50);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Paginare invalidă.');
  return { page, limit, offset: (page - 1) * limit };
}
function dateFilter(query, clauses, args) {
  for (const [name, operator] of [['since', '>='], ['until', '<=']]) {
    if (!query[name]) continue;
    const date = new Date(query[name]);
    if (!Number.isFinite(date.getTime())) throw new Error('Perioadă invalidă.');
    clauses.push(`w.occurred_at ${operator} ?`);
    args.push(date.toISOString().slice(0, 23).replace('T', ' '));
  }
}
function rowRecord(row) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return { ...payload, revision: row.revision };
}

// Dependencies are injectable: route tests do not connect to the production DB.
export async function registerWellbeingRoutes(app, { pool, jwtSecret, adminAuth }) {
  async function requirePaid(request, reply) {
    let userId;
    try {
      const auth = request.headers.authorization;
      if (!auth?.startsWith('Bearer ')) throw new Error();
      userId = Number(jwt.verify(auth.slice(7), jwtSecret).sub);
      if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error();
    } catch { reply.code(401).send({ error: 'Neautorizat' }); return; }
    const [rows] = await pool.query(`SELECT u.id FROM users u JOIN subscriptions s ON s.user_id = u.id
      WHERE u.id = ? AND s.type IN ('basic','premium','vip','pro')
      AND s.starts_at <= NOW() AND (s.ends_at IS NULL OR s.ends_at > NOW()) LIMIT 1`, [userId]);
    if (!rows.length) { reply.code(403).send({ error: 'Este necesar un abonament plătit activ.' }); return; }
    request.wellbeingUserId = userId;
  }
  for (const [kind, table] of Object.entries(TABLES)) {
    app.post(`/api/wellbeing/${kind}`, { preHandler: requirePaid }, async (request, reply) => {
      let record;
      try { record = validateRecord(kind, request.body); } catch (error) { return reply.code(400).send({ error: error.message }); }
      await pool.query(`INSERT INTO ${table} (user_id, client_id, occurred_at, payload) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE client_id = client_id`, [request.wellbeingUserId, record.clientId, record.occurredAt.slice(0, 23).replace('T', ' '), JSON.stringify(record)]);
      const [rows] = await pool.query(`SELECT payload, revision FROM ${table} WHERE user_id = ? AND client_id = ?`, [request.wellbeingUserId, record.clientId]);
      return { item: rowRecord(rows[0]) };
    });
    app.get(`/api/wellbeing/${kind}`, { preHandler: requirePaid }, async (request, reply) => {
      let pagination;
      const clauses = ['w.user_id = ?'], args = [request.wellbeingUserId];
      try { pagination = parsePage(request.query); dateFilter(request.query, clauses, args); } catch (error) { return reply.code(400).send({ error: error.message }); }
      const { page, limit, offset } = pagination;
      const [rows] = await pool.query(`SELECT w.payload, w.revision FROM ${table} w WHERE ${clauses.join(' AND ')} ORDER BY w.occurred_at DESC, w.id DESC LIMIT ? OFFSET ?`, [...args, limit + 1, offset]);
      return { items: rows.slice(0, limit).map(rowRecord), page, limit, hasMore: rows.length > limit };
    });
    app.get(`/api/admin/wellbeing/${kind}`, async (request, reply) => {
      if (!await adminAuth(request)) return reply.code(403).send({ error: 'Forbidden' });
      const clauses = ['1 = 1'], args = [];
      let pagination;
      try {
        pagination = parsePage(request.query);
        dateFilter(request.query, clauses, args);
        if (request.query.user_id) {
          const userId = Number(request.query.user_id);
          if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Utilizator invalid.');
          clauses.push('w.user_id = ?'); args.push(userId);
        }
      } catch (error) { return reply.code(400).send({ error: error.message }); }
      const { page, limit, offset } = pagination;
      const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} w WHERE ${clauses.join(' AND ')}`, args);
      const [rows] = await pool.query(`SELECT w.id, w.user_id, w.payload, w.revision, u.name AS user_name, u.email FROM ${table} w JOIN users u ON u.id = w.user_id WHERE ${clauses.join(' AND ')} ORDER BY w.occurred_at DESC, w.id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
      return { items: rows.map((row) => ({ ...rowRecord(row), id: row.id, userId: row.user_id, userName: row.user_name, email: row.email })), total, page, limit };
    });
    app.get(`/api/admin/wellbeing/${kind}/:id`, async (request, reply) => {
      if (!await adminAuth(request)) return reply.code(403).send({ error: 'Forbidden' });
      const id = Number(request.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid.' });
      const [rows] = await pool.query(`SELECT w.id, w.user_id, w.payload, w.revision, u.name AS user_name, u.email FROM ${table} w JOIN users u ON u.id = w.user_id WHERE w.id = ?`, [id]);
      if (!rows.length) return reply.code(404).send({ error: 'Nu a fost găsit.' });
      const row = rows[0];
      return { item: { ...rowRecord(row), id: row.id, userId: row.user_id, userName: row.user_name, email: row.email } };
    });
  }
  app.patch('/api/wellbeing/sessions/:clientId/feedback', { preHandler: requirePaid }, async (request, reply) => {
    const clientId = String(request.params.clientId).toLowerCase();
    let feedback;
    const revision = request.body?.revision;
    try {
      if (!UUID.test(clientId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Revizie invalidă.');
      feedback = validateFeedback(request.body.feedback);
    } catch (error) { return reply.code(400).send({ error: error.message }); }
    await pool.query(`UPDATE wellbeing_sessions SET payload = JSON_SET(payload, '$.feedback', CAST(? AS JSON)), revision = ?
      WHERE user_id = ? AND client_id = ? AND revision < ?`, [JSON.stringify(feedback), revision, request.wellbeingUserId, clientId, revision]);
    const [rows] = await pool.query('SELECT payload, revision FROM wellbeing_sessions WHERE user_id = ? AND client_id = ?', [request.wellbeingUserId, clientId]);
    if (!rows.length) return reply.code(404).send({ error: 'Nu a fost găsit.' });
    return { item: rowRecord(rows[0]) };
  });
}

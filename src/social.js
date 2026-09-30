import jwt from 'jsonwebtoken';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => Object.assign(new Error(message), { statusCode: status });
const id = (value) => { const number = Number(value); if (!Number.isSafeInteger(number) || number < 1) throw fail(400, 'Identificator invalid.'); return number; };
export function pairOf(a, b) { a = id(a); b = id(b); if (a === b) throw fail(400, 'Alege o altă persoană.'); return [Math.min(a, b), Math.max(a, b)]; }
function cursor(value) { return value == null ? null : id(value); }
export function validateAudio(value) {
  if (!value || !UUID.test(value.clientId) || typeof value.mediaKey !== 'string' || !/^[\w.-]{1,190}$/.test(value.mediaKey)) throw fail(400, 'Audio invalid.');
  if (!Number.isInteger(value.listenedMs) || value.listenedMs < 0 || !Number.isInteger(value.durationMs) || value.durationMs < 1 || value.durationMs > 86400000 || value.listenedMs > value.durationMs) throw fail(400, 'Durată invalidă.');
  if (typeof value.completed !== 'boolean' || (value.completed && value.listenedMs < value.durationMs * 0.9)) throw fail(400, 'Ascultare incompletă.');
  const date = new Date(value.occurredAt);
  if (typeof value.occurredAt !== 'string' || !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2000 || date.getTime() > Date.now() + 300000) throw fail(400, 'Dată invalidă.');
  return { ...value, clientId: value.clientId.toLowerCase(), occurredAt: date };
}
export function visibleStats(owner, target, shared) { return owner === target || Boolean(shared); }

export async function migrateSocial(pool) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS audio_activity (
      id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, client_id CHAR(36) NOT NULL,
      media_key VARCHAR(190) NOT NULL, listened_ms INT UNSIGNED NOT NULL, duration_ms INT UNSIGNED NOT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0, occurred_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_audio_client (user_id, client_id), INDEX idx_audio_user_date (user_id, occurred_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS social_preferences (
      user_id BIGINT PRIMARY KEY, share_activity TINYINT(1) NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS friendships (
      id BIGINT PRIMARY KEY AUTO_INCREMENT, user_low BIGINT NOT NULL, user_high BIGINT NOT NULL,
      requested_by BIGINT NOT NULL, status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_friend_pair (user_low, user_high),
      INDEX idx_friend_high (user_high, status),
      FOREIGN KEY (user_low) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_high) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS user_blocks (
      user_id BIGINT NOT NULL, blocked_id BIGINT NOT NULL, PRIMARY KEY (user_id, blocked_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS private_messages (
      id BIGINT PRIMARY KEY AUTO_INCREMENT, sender_id BIGINT NOT NULL, recipient_id BIGINT NOT NULL,
      client_id CHAR(36) NOT NULL, content VARCHAR(2000) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_private_client (sender_id, client_id), INDEX idx_private_pair (sender_id, recipient_id, id),
      INDEX idx_private_recipient (recipient_id, sender_id, id),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS private_reads (
      user_id BIGINT NOT NULL, peer_id BIGINT NOT NULL, last_id BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, peer_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (peer_id) REFERENCES users(id) ON DELETE CASCADE)`,
  ];
  for (const sql of tables) await pool.query(sql);
}

export async function registerSocialRoutes(app, { pool, jwtSecret }) {
  async function auth(request, reply) {
    try {
      const bearer = request.headers.authorization;
      if (!bearer?.startsWith('Bearer ')) throw new Error();
      request.viewer = id(jwt.verify(bearer.slice(7), jwtSecret).sub);
      const [rows] = await pool.query('/* social:user */ SELECT id FROM users WHERE id = ?', [request.viewer]);
      if (!rows.length) throw new Error();
    } catch { return reply.code(401).send({ error: 'Autentifică-te pentru a continua.' }); }
  }
  const route = (method, url, handler, max = 80) => app.route({ method, url, preHandler: auth, config: { rateLimit: { max, timeWindow: '1 minute' } }, handler: async (request, reply) => {
    try { return await handler(request, reply); }
    catch (error) { if (!error.statusCode) request.log.error({ err: error }, 'Activity/social request failed'); return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Nu am putut finaliza cererea.' }); }
  } });
  async function blocked(db, owner, target) {
    const [rows] = await db.query('/* social:block */ SELECT user_id FROM user_blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)', [owner, target, target, owner]);
    return rows.length > 0;
  }
  async function relationship(db, owner, target) {
    const [low, high] = pairOf(owner, target);
    const [rows] = await db.query('/* social:pair */ SELECT * FROM friendships WHERE user_low = ? AND user_high = ?', [low, high]);
    return rows[0] || null;
  }
  async function transaction(owner, target, action) {
    const [low, high] = pairOf(owner, target);
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      // Every pair mutation locks both users in the same order, including block/send.
      const [users] = await db.query('/* social:lock */ SELECT id FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE', [low, high]);
      if (users.length !== 2) throw fail(404, 'Profil indisponibil.');
      const result = await action(db, low, high);
      await db.commit(); return result;
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  }
  async function requireFriend(db, owner, target) {
    const relation = await relationship(db, owner, target);
    if (await blocked(db, owner, target) || relation?.status !== 'accepted') throw fail(403, 'Chatul privat este disponibil între prieteni.');
  }
  async function stats(target) {
    const [audio] = await pool.query(`/* social:audio-stats */ SELECT COUNT(CASE WHEN completed = 1 THEN 1 END) AS audioCompleted,
      COUNT(DISTINCT CASE WHEN completed = 1 THEN media_key END) AS uniqueAudios, COALESCE(SUM(listened_ms),0) AS listenedMs FROM audio_activity WHERE user_id = ?`, [target]);
    const [challenges] = await pool.query('/* social:challenge-stats */ SELECT COUNT(*) AS challengesCompleted, COUNT(DISTINCT challenge_id) AS uniqueChallenges FROM challenge_runs WHERE user_id = ?', [target]);
    return { audioCompleted: Number(audio[0]?.audioCompleted || 0), uniqueAudios: Number(audio[0]?.uniqueAudios || 0), listeningMinutes: Math.floor(Number(audio[0]?.listenedMs || 0) / 60000), challengesCompleted: Number(challenges[0]?.challengesCompleted || 0), uniqueChallenges: Number(challenges[0]?.uniqueChallenges || 0) };
  }
  route('POST', '/api/activity/audio', async (req) => {
    const value = validateAudio(req.body);
    // An ID cannot be reused for a different lesson, even after a lost response.
    await pool.query(`/* social:audio-save */ INSERT INTO audio_activity (user_id,client_id,media_key,listened_ms,duration_ms,completed,occurred_at) VALUES (?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE listened_ms = IF(media_key = VALUES(media_key) AND duration_ms = VALUES(duration_ms), GREATEST(listened_ms,VALUES(listened_ms)),listened_ms),
      completed = IF(media_key = VALUES(media_key) AND duration_ms = VALUES(duration_ms), GREATEST(completed,VALUES(completed)),completed)`, [req.viewer,value.clientId,value.mediaKey,value.listenedMs,value.durationMs,value.completed ? 1 : 0,value.occurredAt]);
    const [rows] = await pool.query('/* social:audio-get */ SELECT media_key,duration_ms FROM audio_activity WHERE user_id = ? AND client_id = ?', [req.viewer,value.clientId]);
    if (rows[0]?.media_key !== value.mediaKey || Number(rows[0]?.duration_ms) !== value.durationMs) throw fail(409,'Identificatorul aparține unei alte ascultări.');
    return { ok: true };
  });
  route('GET', '/api/activity/stats', async (req) => ({ stats: await stats(req.viewer) }));
  route('PUT', '/api/social/preferences', async (req) => {
    if (typeof req.body?.shareActivity !== 'boolean') throw fail(400, 'Preferință invalidă.');
    await pool.query('/* social:preferences-save */ INSERT INTO social_preferences (user_id,share_activity) VALUES (?,?) ON DUPLICATE KEY UPDATE share_activity = VALUES(share_activity)', [req.viewer, req.body.shareActivity ? 1 : 0]);
    return { shareActivity: req.body.shareActivity };
  });
  route('GET', '/api/social/profiles/:id', async (req) => {
    const target = id(req.params.id);
    if (target !== req.viewer && await blocked(pool, req.viewer, target)) throw fail(404, 'Profil indisponibil.');
    const [users] = await pool.query('/* social:profile */ SELECT u.id,u.name,u.avatar_url,COALESCE(p.share_activity,0) AS share_activity FROM users u LEFT JOIN social_preferences p ON p.user_id = u.id WHERE u.id = ?', [target]);
    if (!users.length) throw fail(404, 'Profil indisponibil.');
    const user = users[0];
    const relation = target === req.viewer ? null : await relationship(pool, req.viewer, target);
    return { user: { id: user.id, name: user.name, avatar_url: user.avatar_url }, shareActivity: Boolean(user.share_activity), relationship: target === req.viewer ? 'self' : relation?.status === 'accepted' ? 'friend' : relation ? (Number(relation.requested_by) === req.viewer ? 'outgoing' : 'incoming') : 'none', stats: visibleStats(req.viewer,target,user.share_activity) ? await stats(target) : null };
  });
  route('GET', '/api/social/people', async (req) => {
    const text = String(req.query?.q || '').trim();
    if (text.length < 2 || text.length > 60) throw fail(400, 'Caută după cel puțin două caractere.');
    const after = cursor(req.query?.after) || 0;
    const [rows] = await pool.query(`/* social:search */ SELECT u.id,u.name,u.avatar_url FROM users u WHERE u.id != ? AND u.id > ? AND u.name LIKE ? ESCAPE '!'
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id = ? AND b.blocked_id = u.id) OR (b.blocked_id = ? AND b.user_id = u.id)) ORDER BY u.id LIMIT 31`, [req.viewer,after,`%${text.replace(/[!%_]/g,'!$&')}%`,req.viewer,req.viewer]);
    return { items: rows.slice(0,30), hasMore: rows.length > 30, next: rows.length > 30 ? rows[29].id : null };
  });
  route('GET', '/api/social/friends', async (req) => {
    const after = cursor(req.query?.after) || 0;
    const [rows] = await pool.query(`/* social:friends */ SELECT f.id AS friendshipId,f.status,f.requested_by,u.id,u.name,u.avatar_url,
      (SELECT COUNT(*) FROM private_messages m LEFT JOIN private_reads r ON r.user_id = ? AND r.peer_id = u.id WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.id > COALESCE(r.last_id,0)) AS unreadCount
      FROM friendships f JOIN users u ON u.id = IF(f.user_low = ?,f.user_high,f.user_low)
      WHERE (f.user_low = ? OR f.user_high = ?) AND f.id > ?
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id = ? AND b.blocked_id = u.id) OR (b.blocked_id = ? AND b.user_id = u.id)) ORDER BY f.id LIMIT 51`, [req.viewer,req.viewer,req.viewer,req.viewer,req.viewer,after,req.viewer,req.viewer]);
    return { items: rows.slice(0,50).map((r) => ({ ...r, relationship: r.status === 'accepted' ? 'friend' : Number(r.requested_by) === req.viewer ? 'outgoing' : 'incoming', unreadCount: Number(r.unreadCount) })), hasMore: rows.length > 50, next: rows.length > 50 ? rows[49].friendshipId : null };
  });
  route('GET', '/api/social/unread-count', async (req) => {
    const [rows] = await pool.query(`/* social:unread */ SELECT
      (SELECT COUNT(*) FROM friendships f WHERE (f.user_low = ? OR f.user_high = ?) AND f.status = 'pending' AND f.requested_by != ?) AS requests,
      (SELECT COUNT(*) FROM private_messages m JOIN friendships f ON f.user_low = LEAST(m.sender_id,m.recipient_id) AND f.user_high = GREATEST(m.sender_id,m.recipient_id) AND f.status = 'accepted'
        LEFT JOIN private_reads r ON r.user_id = ? AND r.peer_id = m.sender_id
        WHERE m.recipient_id = ? AND m.id > COALESCE(r.last_id,0)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id = ? AND b.blocked_id = m.sender_id) OR (b.blocked_id = ? AND b.user_id = m.sender_id))) AS messages`, Array(7).fill(req.viewer));
    return { unreadCount: Number(rows[0]?.requests || 0) + Number(rows[0]?.messages || 0) };
  });
  route('POST', '/api/social/friends/:id', async (req) => transaction(req.viewer,id(req.params.id),async (db,low,high) => {
    if (await blocked(db,req.viewer,id(req.params.id))) throw fail(403,'Cererea nu poate fi trimisă.');
    await db.query('/* social:request */ INSERT INTO friendships (user_low,user_high,requested_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id = id', [low,high,req.viewer]);
    return { ok: true };
  }), 10);
  route('POST', '/api/social/friends/:id/accept', async (req) => transaction(req.viewer,id(req.params.id),async (db,low,high) => {
    const relation = await relationship(db,req.viewer,id(req.params.id));
    if (await blocked(db,req.viewer,id(req.params.id)) || !relation || Number(relation.requested_by) === req.viewer) throw fail(403,'Doar destinatarul poate accepta cererea.');
    await db.query("/* social:accept */ UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?", [low,high]);
    return { ok: true };
  }));
  route('DELETE', '/api/social/friends/:id', async (req) => transaction(req.viewer,id(req.params.id),async (db,low,high) => {
    await db.query('/* social:remove */ DELETE FROM friendships WHERE user_low = ? AND user_high = ?', [low,high]); return { ok: true };
  }));
  route('POST', '/api/social/blocks/:id', async (req) => transaction(req.viewer,id(req.params.id),async (db,low,high) => {
    await db.query('/* social:block-save */ INSERT IGNORE INTO user_blocks (user_id,blocked_id) VALUES (?,?)', [req.viewer,id(req.params.id)]);
    await db.query('/* social:remove */ DELETE FROM friendships WHERE user_low = ? AND user_high = ?', [low,high]); return { ok: true };
  }));
  route('GET', '/api/social/blocks', async (req) => {
    const after = cursor(req.query?.after) || 0;
    const [rows] = await pool.query('/* social:blocked-list */ SELECT u.id,u.name,u.avatar_url FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? AND u.id > ? ORDER BY u.id LIMIT 51', [req.viewer,after]);
    return { items: rows.slice(0,50), hasMore: rows.length > 50, next: rows.length > 50 ? rows[49].id : null };
  });
  route('DELETE', '/api/social/blocks/:id', async (req) => transaction(req.viewer,id(req.params.id),async (db) => {
    await db.query('/* social:unblock */ DELETE FROM user_blocks WHERE user_id = ? AND blocked_id = ?', [req.viewer,id(req.params.id)]); return { ok: true };
  }));
  route('GET', '/api/social/private/:id/messages', async (req) => {
    const target = id(req.params.id); await requireFriend(pool,req.viewer,target);
    const before = cursor(req.query?.before), after = cursor(req.query?.after);
    if (before && after) throw fail(400,'Alege o singură direcție de paginare.');
    const [rows] = await pool.query(`/* social:messages */ SELECT id,sender_id AS senderId,recipient_id AS recipientId,client_id AS clientId,content,created_at AS createdAt FROM private_messages
      WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) ${before ? 'AND id < ?' : after ? 'AND id > ?' : ''} ORDER BY id ${after ? 'ASC' : 'DESC'} LIMIT 51`, [req.viewer,target,target,req.viewer,...(before ? [before] : after ? [after] : [])]);
    const items = rows.slice(0,50); if (!after) items.reverse();
    return { items, hasMore: rows.length > 50 };
  });
  route('POST', '/api/social/private/:id/messages', async (req) => {
    const target = id(req.params.id), content = typeof req.body?.content === 'string' ? req.body.content.trim() : null;
    if (!UUID.test(req.body?.clientId) || typeof content !== 'string' || !content || content.length > 2000) throw fail(400,'Mesaj invalid (maximum 2000 de caractere).');
    return transaction(req.viewer,target,async (db) => {
      await requireFriend(db,req.viewer,target);
      await db.query('/* social:message-save */ INSERT INTO private_messages (sender_id,recipient_id,client_id,content) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id = id', [req.viewer,target,req.body.clientId.toLowerCase(),content]);
      const [rows] = await db.query('/* social:message-get */ SELECT id,sender_id AS senderId,recipient_id AS recipientId,client_id AS clientId,content,created_at AS createdAt FROM private_messages WHERE sender_id = ? AND client_id = ?', [req.viewer,req.body.clientId.toLowerCase()]);
      if (Number(rows[0]?.recipientId) !== target || rows[0]?.content !== content) throw fail(409,'Identificatorul aparține altui mesaj.');
      return { item: rows[0] };
    });
  }, 30);
  route('POST', '/api/social/private/:id/read', async (req) => {
    const target = id(req.params.id), last = id(req.body?.lastId); await requireFriend(pool,req.viewer,target);
    const [rows] = await pool.query('/* social:read-check */ SELECT id FROM private_messages WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))', [last,req.viewer,target,target,req.viewer]);
    if (!rows.length) throw fail(400,'Mesaj indisponibil.');
    await pool.query('/* social:read-save */ INSERT INTO private_reads (user_id,peer_id,last_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE last_id = GREATEST(last_id,VALUES(last_id))', [req.viewer,target,last]); return { ok: true };
  });
}

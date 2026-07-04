import jwt from 'jsonwebtoken';
import { mysqlPool } from '../mysql.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');

function extractAuthToken(request, options = {}) {
  const allowQueryToken = options?.allowQueryToken === true;
  const authHeader = request.headers?.authorization || request.headers?.Authorization || '';

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (!allowQueryToken) return null;

  const queryToken =
    request.query?.token ||
    request.query?.authToken ||
    request.query?.accessToken ||
    null;

  return typeof queryToken === 'string' ? queryToken.trim() : null;
}

function normalizeDisplayName(nameFromDb, fallbackName = null) {
  const primary = String(nameFromDb || '').trim();
  if (primary.length) return primary;

  const fallback = String(fallbackName || '').trim();
  return fallback.length ? fallback : 'Utilizator';
}

async function getChatUserProfile(userId, fallbackName = null) {
  const [rows] = await mysqlPool.query(
    'SELECT id, name, avatar_url FROM users WHERE id = ? LIMIT 1',
    [Number(userId)]
  );

  if (!Array.isArray(rows) || !rows.length) return null;

  const row = rows[0];
  return {
    id: Number(row.id),
    displayName: normalizeDisplayName(row.name, fallbackName),
    avatar: row.avatar_url || null,
  };
}

async function getActiveSubscription(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT id, type, starts_at, ends_at
     FROM subscriptions
     WHERE user_id = ?
       AND type IN ('basic','premium','vip','pro')
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [Number(userId)]
  );

  if (!Array.isArray(rows) || !rows.length) return null;

  const row = rows[0];
  return {
    id: Number(row.id),
    type: row.type,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
  };
}

/**
 * Fastify auth hook for chat: allows access to any authenticated user.
 * Chat-ul comunității este deschis tuturor utilizatorilor logați,
 * indiferent de abonament.
 *
 * The hook attaches `request.chatUser` (and `request.subscription`
 * when one exists) for downstream handlers.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 * @param {{ allowQueryToken?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function requireChatUser(request, reply, options = {}) {
  const token = extractAuthToken(request, options);
  if (!token) {
    reply.code(401).send({ error: 'Neautorizat' });
    return;
  }

  let decodedJwt;
  try {
    decodedJwt = jwt.verify(token, JWT_SECRET);
  } catch {
    reply.code(401).send({ error: 'Neautorizat' });
    return;
  }

  const userId = Number(decodedJwt?.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    reply.code(401).send({ error: 'Neautorizat' });
    return;
  }

  const chatUser = await getChatUserProfile(userId, decodedJwt?.name);
  if (!chatUser) {
    reply.code(401).send({ error: 'Neautorizat' });
    return;
  }

  request.chatUser = chatUser;
  request.subscription = await getActiveSubscription(chatUser.id);
}

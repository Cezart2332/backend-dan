import { Filter } from 'bad-words';
import { mysqlPool } from '../mysql.js';

const MESSAGE_RATE_LIMIT_COUNT = 5;
const MESSAGE_RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LIMIT = 50;

const profanityFilter = new Filter();
const socketsByUserId = new Map();
const messageTimestampsByUserId = new Map();

function isSocketOpen(socket) {
  return Boolean(socket) && socket.readyState === 1;
}

function safeSend(socket, payload) {
  if (!isSocketOpen(socket)) return false;

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function normalizeDisplayName(value) {
  const normalized = String(value || '').trim();
  return normalized.length ? normalized : 'Utilizator';
}

function pruneStaleMessageTimestamps(userId, nowMs) {
  const timestamps = messageTimestampsByUserId.get(userId) || [];
  const validTimestamps = timestamps.filter((ts) => nowMs - ts < MESSAGE_RATE_LIMIT_WINDOW_MS);
  messageTimestampsByUserId.set(userId, validTimestamps);
  return validTimestamps;
}

function consumeRateLimitSlot(userId) {
  const nowMs = Date.now();
  const validTimestamps = pruneStaleMessageTimestamps(userId, nowMs);

  if (validTimestamps.length >= MESSAGE_RATE_LIMIT_COUNT) {
    const oldestMs = validTimestamps[0] || nowMs;
    const retryAfterMs = Math.max(0, MESSAGE_RATE_LIMIT_WINDOW_MS - (nowMs - oldestMs));
    return { allowed: false, retryAfterMs };
  }

  validTimestamps.push(nowMs);
  messageTimestampsByUserId.set(userId, validTimestamps);
  return { allowed: true, retryAfterMs: 0 };
}

function broadcastPayload(payload) {
  for (const [userId, userSockets] of socketsByUserId.entries()) {
    const socketsToRemove = [];

    for (const socket of userSockets) {
      const sent = safeSend(socket, payload);
      if (!sent) socketsToRemove.push(socket);
    }

    for (const socket of socketsToRemove) {
      userSockets.delete(socket);
    }

    if (!userSockets.size) {
      socketsByUserId.delete(userId);
      messageTimestampsByUserId.delete(userId);
    }
  }
}

async function insertChatMessage(userId, content) {
  const [insertResult] = await mysqlPool.query(
    'INSERT INTO chat_messages (user_id, content) VALUES (?, ?)',
    [Number(userId), content]
  );

  const messageId = Number(insertResult?.insertId || 0);
  if (!messageId) {
    return {
      id: null,
      user_id: Number(userId),
      display_name: null,
      avatar_url: null,
      content,
      created_at: new Date().toISOString(),
    };
  }

  const [rows] = await mysqlPool.query(
    `SELECT cm.id, cm.user_id, cm.content, cm.created_at, u.name AS display_name, u.avatar_url
     FROM chat_messages cm
     INNER JOIN users u ON u.id = cm.user_id
     WHERE cm.id = ?
     LIMIT 1`,
    [messageId]
  );

  if (!Array.isArray(rows) || !rows.length) {
    return {
      id: messageId,
      user_id: Number(userId),
      display_name: null,
      avatar_url: null,
      content,
      created_at: new Date().toISOString(),
    };
  }

  return rows[0];
}

function formatIsoDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function buildMessagePayload(messageRow, fallbackUser) {
  return {
    type: 'message',
    userId: String(messageRow?.user_id || fallbackUser?.id || ''),
    displayName: normalizeDisplayName(messageRow?.display_name || fallbackUser?.displayName),
    avatar: messageRow?.avatar_url || fallbackUser?.avatar || null,
    content: String(messageRow?.content || ''),
    createdAt: formatIsoDate(messageRow?.created_at),
  };
}

function buildHistoryItem(messageRow) {
  return {
    id: Number(messageRow.id),
    type: 'message',
    userId: String(messageRow.user_id),
    displayName: normalizeDisplayName(messageRow.display_name),
    avatar: messageRow.avatar_url || null,
    content: String(messageRow.content || ''),
    createdAt: formatIsoDate(messageRow.created_at),
  };
}

/**
 * Registers a websocket connection for a chat user.
 *
 * @param {{ id: number, displayName: string, avatar: string|null }} chatUser
 * @param {any} socket
 * @returns {boolean} True when this is the first active connection for the user.
 */
export function registerChatConnection(chatUser, socket) {
  const userId = Number(chatUser?.id);
  if (!Number.isFinite(userId) || userId <= 0 || !socket) return false;

  let userSockets = socketsByUserId.get(userId);
  const isFirstConnection = !userSockets || userSockets.size === 0;

  if (!userSockets) {
    userSockets = new Set();
    socketsByUserId.set(userId, userSockets);
  }

  userSockets.add(socket);
  return isFirstConnection;
}

/**
 * Unregisters a websocket connection for a chat user.
 *
 * @param {{ id: number }} chatUser
 * @param {any} socket
 * @returns {boolean} True when this was the last active connection for the user.
 */
export function unregisterChatConnection(chatUser, socket) {
  const userId = Number(chatUser?.id);
  if (!Number.isFinite(userId) || userId <= 0 || !socket) return false;

  const userSockets = socketsByUserId.get(userId);
  if (!userSockets) return false;

  userSockets.delete(socket);
  if (userSockets.size) return false;

  socketsByUserId.delete(userId);
  messageTimestampsByUserId.delete(userId);
  return true;
}

/**
 * Broadcasts a join/leave system notification to connected chat users.
 *
 * @param {{ event: 'join'|'leave', chatUser: { id: number, displayName: string } }} params
 * @returns {void}
 */
export function broadcastSystemEvent({ event, chatUser }) {
  const normalizedEvent = event === 'leave' ? 'leave' : 'join';
  const displayName = normalizeDisplayName(chatUser?.displayName);

  const content =
    normalizedEvent === 'join'
      ? `${displayName} s-a alaturat comunitatii.`
      : `${displayName} a parasit comunitatea.`;

  broadcastPayload({
    type: 'system',
    userId: String(chatUser?.id || ''),
    displayName,
    avatar: chatUser?.avatar || null,
    content,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Handles a websocket chat event from a connected user.
 *
 * @param {{ socket: any, rawData: Buffer|string, chatUser: { id: number, displayName: string, avatar: string|null } }} params
 * @returns {Promise<void>}
 */
export async function handleChatSocketMessage({ socket, rawData, chatUser }) {
  const rawText = typeof rawData === 'string' ? rawData : rawData?.toString('utf8');
  if (!rawText) {
    safeSend(socket, { type: 'error', error: 'Payload invalid.' });
    return;
  }

  if (rawText === 'ping') {
    safeSend(socket, { type: 'ping', createdAt: new Date().toISOString() });
    return;
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(rawText);
  } catch {
    safeSend(socket, { type: 'error', error: 'Payload JSON invalid.' });
    return;
  }

  const payloadType = String(parsedPayload?.type || '').toLowerCase();

  if (payloadType === 'ping') {
    safeSend(socket, { type: 'ping', createdAt: new Date().toISOString() });
    return;
  }

  if (payloadType === 'system') {
    safeSend(socket, {
      type: 'error',
      error: 'Mesajele de sistem sunt generate doar de server.',
    });
    return;
  }

  if (payloadType !== 'message') {
    safeSend(socket, {
      type: 'error',
      error: 'Tip mesaj necunoscut.',
    });
    return;
  }

  if (typeof parsedPayload?.content !== 'string') {
    safeSend(socket, {
      type: 'error',
      error: 'Continutul mesajului este invalid.',
    });
    return;
  }

  const content = parsedPayload.content.trim();
  if (!content.length) {
    safeSend(socket, {
      type: 'error',
      error: 'Mesajul nu poate fi gol.',
    });
    return;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    safeSend(socket, {
      type: 'error',
      error: 'Mesajul depaseste limita de 500 de caractere.',
    });
    return;
  }

  if (profanityFilter.isProfane(content)) {
    safeSend(socket, {
      type: 'error',
      error: 'Mesajul contine limbaj nepotrivit.',
    });
    return;
  }

  const limitResult = consumeRateLimitSlot(Number(chatUser.id));
  if (!limitResult.allowed) {
    safeSend(socket, {
      type: 'error',
      error: 'Trimiti mesaje prea rapid. Incearca din nou in cateva secunde.',
      retryAfterMs: limitResult.retryAfterMs,
    });
    return;
  }

  const savedMessage = await insertChatMessage(chatUser.id, content);
  const payload = buildMessagePayload(savedMessage, chatUser);
  broadcastPayload(payload);
}

/**
 * Returns paginated chat history for subscribed users.
 *
 * @param {{ beforeMessageId?: number|null, limit?: number }} [params]
 * @returns {Promise<{ items: Array<object>, hasMore: boolean, nextBefore: number|null }>} 
 */
export async function getChatHistoryPage(params = {}) {
  const beforeMessageId = Number.isFinite(Number(params.beforeMessageId))
    ? Number(params.beforeMessageId)
    : null;

  const limit = Math.min(MAX_HISTORY_LIMIT, Math.max(1, Number(params.limit) || MAX_HISTORY_LIMIT));

  const whereClauses = [];
  const queryParams = [];

  if (beforeMessageId && beforeMessageId > 0) {
    whereClauses.push('cm.id < ?');
    queryParams.push(beforeMessageId);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await mysqlPool.query(
    `SELECT cm.id, cm.user_id, cm.content, cm.created_at, u.name AS display_name, u.avatar_url
     FROM chat_messages cm
     INNER JOIN users u ON u.id = cm.user_id
     ${whereSql}
     ORDER BY cm.id DESC
     LIMIT ?`,
    [...queryParams, limit + 1]
  );

  const normalizedRows = Array.isArray(rows) ? rows : [];
  const hasMore = normalizedRows.length > limit;
  const pageRows = hasMore ? normalizedRows.slice(0, limit) : normalizedRows;
  const items = pageRows.reverse().map(buildHistoryItem);
  const nextBefore = items.length ? Number(items[0].id) : null;

  return { items, hasMore, nextBefore };
}

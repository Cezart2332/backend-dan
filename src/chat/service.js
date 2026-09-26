import { mysqlPool } from '../mysql.js';
import { isExpoPushToken, sendPushToExpoTokens } from '../push.js';

const MESSAGE_RATE_LIMIT_COUNT = 5;
const MESSAGE_RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LIMIT = 50;
const PUSH_PREVIEW_LENGTH = 140;

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
  const messageId = Number(messageRow?.id);
  return {
    type: 'message',
    id: Number.isFinite(messageId) && messageId > 0 ? messageId : null,
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
 * Trimite tuturor numarul de utilizatori cu chatul deschis.
 *
 * @returns {void}
 */
export function broadcastPresence() {
  broadcastPayload({ type: 'presence', online: socketsByUserId.size });
}

function normalizeClientId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 64);
  return trimmed.length ? trimmed : null;
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

  // Clientul trimite un id propriu ca sa poata confirma (sau marca esuat)
  // mesajul afisat deja local, inainte de raspunsul serverului.
  const clientId = normalizeClientId(parsedPayload?.clientId);
  const sendError = (error, extra = {}) => {
    safeSend(socket, { type: 'error', error, ...(clientId ? { clientId } : {}), ...extra });
  };

  if (typeof parsedPayload?.content !== 'string') {
    sendError('Continutul mesajului este invalid.');
    return;
  }

  const content = parsedPayload.content.trim();
  if (!content.length) {
    sendError('Mesajul nu poate fi gol.');
    return;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    sendError(`Mesajul depaseste limita de ${MAX_MESSAGE_LENGTH} de caractere.`);
    return;
  }

  const limitResult = consumeRateLimitSlot(Number(chatUser.id));
  if (!limitResult.allowed) {
    sendError('Trimiti mesaje prea rapid. Incearca din nou in cateva secunde.', {
      retryAfterMs: limitResult.retryAfterMs,
    });
    return;
  }

  let savedMessage;
  try {
    savedMessage = await insertChatMessage(chatUser.id, content);
  } catch (error) {
    sendError('Mesajul nu a putut fi salvat. Incearca din nou.');
    if (error && typeof error === 'object') error.clientNotified = true;
    throw error;
  }

  const payload = {
    ...buildMessagePayload(savedMessage, chatUser),
    ...(clientId ? { clientId } : {}),
  };
  broadcastPayload(payload);

  // Notificare push imediata pentru fiecare mesaj nou (stil WhatsApp).
  sendChatMessagePush({ message: payload, senderUserId: chatUser.id }).catch(() => {});

  // Cine scrie în chat este în conversație, deci a citit tot ce e până acum —
  // evită notificări de "mesaje necitite" pentru participanții activi.
  markChatAsRead(chatUser.id).catch(() => {});
}

function buildChatPushPreview(content) {
  const normalized = String(content || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= PUSH_PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, PUSH_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

/**
 * Trimite o notificare push pentru un mesaj nou din chat catre toti membrii,
 * mai putin autorul si cei care au chatul deschis (primesc mesajul live).
 *
 * @param {{ message: object, senderUserId: number|string }} params
 * @returns {Promise<{ sentCount: number }>}
 */
export async function sendChatMessagePush({ message, senderUserId }) {
  const senderId = Number(senderUserId);
  if (!Number.isFinite(senderId) || senderId <= 0) return { sentCount: 0 };

  // Utilizatorii cu socket deschis sunt deja in conversatie.
  const connectedUserIds = [...socketsByUserId.keys()].filter((id) => Number.isFinite(Number(id)));
  const excludedUserIds = [...new Set([senderId, ...connectedUserIds.map(Number)])];
  const placeholders = excludedUserIds.map(() => '?').join(', ');

  const [rows] = await mysqlPool.query(
    `SELECT DISTINCT expo_push_token
     FROM user_push_tokens
     WHERE enabled = 1
       AND user_id NOT IN (${placeholders})
       AND user_id NOT IN (SELECT user_id FROM user_notification_prefs WHERE chat_push = 0)`,
    excludedUserIds
  );

  const tokens = (Array.isArray(rows) ? rows : [])
    .map((row) => row.expo_push_token)
    .filter((token) => isExpoPushToken(token));

  if (!tokens.length) return { sentCount: 0 };

  const senderName = normalizeDisplayName(message?.displayName);
  const result = await sendPushToExpoTokens({
    tokens,
    title: `${senderName} · Comunitate`,
    body: buildChatPushPreview(message?.content),
    data: {
      type: 'chat_message',
      messageId: message?.id ?? null,
      senderId: String(senderId),
    },
    channelId: 'chat',
  });

  if (result.invalidTokens?.length) {
    const invalidPlaceholders = result.invalidTokens.map(() => '?').join(', ');
    await mysqlPool.query(
      `UPDATE user_push_tokens
       SET enabled = 0, updated_at = CURRENT_TIMESTAMP
       WHERE expo_push_token IN (${invalidPlaceholders})`,
      result.invalidTokens
    );
  }

  return { sentCount: result.sentCount };
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

/**
 * Numarul de mesaje necitite (de la altii), plafonat la 100. Utilizatorii
 * care n-au deschis niciodata chatul nu primesc tot istoricul ca "necitit".
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getChatUnreadCount(userId) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return 0;

  const [readRows] = await mysqlPool.query(
    'SELECT last_read_message_id FROM chat_user_reads WHERE user_id = ? LIMIT 1',
    [normalizedUserId]
  );
  if (!Array.isArray(readRows) || !readRows.length) return 0;

  const lastReadId = Number(readRows[0].last_read_message_id || 0);
  const [rows] = await mysqlPool.query(
    `SELECT COUNT(*) AS unread_count
     FROM (
       SELECT 1 FROM chat_messages
       WHERE id > ? AND user_id <> ?
       LIMIT 100
     ) unread`,
    [lastReadId, normalizedUserId]
  );

  return Array.isArray(rows) && rows.length ? Number(rows[0].unread_count || 0) : 0;
}

/**
 * Marks all chat messages as read for a user by recording the latest message ID.
 *
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function markChatAsRead(userId) {
  const [maxRows] = await mysqlPool.query(
    'SELECT MAX(id) AS max_id FROM chat_messages'
  );
  const maxId = Array.isArray(maxRows) && maxRows.length ? Number(maxRows[0].max_id || 0) : 0;
  if (!maxId) return;

  await mysqlPool.query(
    `INSERT INTO chat_user_reads (user_id, last_read_message_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_read_message_id = VALUES(last_read_message_id), updated_at = CURRENT_TIMESTAMP`,
    [Number(userId), maxId]
  );
}

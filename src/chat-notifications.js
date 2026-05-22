import { mysqlPool } from './mysql.js';
import { isExpoPushToken, sendPushToExpoTokens } from './push.js';
import { getUsersWithUnreadMessages, updateChatNotificationTimestamp } from './chat/service.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Finds users with unread chat messages and sends them a push notification.
 * Runs on startup and then every 6 hours.
 *
 * @param {{ log: import('fastify').FastifyLoggerInstance }} app
 */
export async function runChatUnreadNotificationTask({ log }) {
  log.info('[chat-notify] Checking for unread chat messages...');

  try {
    const users = await getUsersWithUnreadMessages({ minHoursSinceNotify: 6 });
    if (!users.length) {
      log.info('[chat-notify] No users with unread messages to notify.');
      return;
    }

    log.info(`[chat-notify] Found ${users.length} users with unread messages.`);

    // Group by user (a user might have multiple tokens)
    const tokensByUser = new Map();
    for (const row of users) {
      const userId = Number(row.user_id);
      const token = row.expo_push_token;
      if (!isExpoPushToken(token)) continue;

      if (!tokensByUser.has(userId)) {
        tokensByUser.set(userId, { tokens: [], unreadCount: Number(row.unread_count || 0) });
      }
      tokensByUser.get(userId).tokens.push(token);
    }

    const notifiedUserIds = [];

    for (const [userId, { tokens, unreadCount }] of tokensByUser.entries()) {
      const body = unreadCount === 1
        ? 'Ai un mesaj nou in chat-ul comunitatii.'
        : `Ai ${unreadCount} mesaje noi in chat-ul comunitatii.`;

      const result = await sendPushToExpoTokens({
        tokens,
        title: 'Dan fost anxios · Chat',
        body,
        data: { type: 'chat_unread', unreadCount },
        logger: log,
      });

      log.info(`[chat-notify] User ${userId}: sent=${result.sentCount}, invalid=${result.invalidTokens.length}`);

      // Disable invalid tokens
      if (result.invalidTokens.length) {
        const placeholders = result.invalidTokens.map(() => '?').join(', ');
        await mysqlPool.query(
          `UPDATE user_push_tokens
           SET enabled = 0, updated_at = CURRENT_TIMESTAMP
           WHERE expo_push_token IN (${placeholders})`,
          result.invalidTokens
        );
      }

      if (result.sentCount > 0) {
        notifiedUserIds.push(userId);
      }
    }

    if (notifiedUserIds.length) {
      await updateChatNotificationTimestamp(notifiedUserIds);
      log.info(`[chat-notify] Updated last_notified_at for ${notifiedUserIds.length} users.`);
    }
  } catch (err) {
    log.error({ err }, '[chat-notify] Background task failed');
  }
}

/**
 * Schedules the chat unread notification task to run every 6 hours.
 *
 * @param {{ log: import('fastify').FastifyLoggerInstance }} app
 */
export function scheduleChatUnreadNotifications({ log }) {
  // Run immediately on startup (with a small delay so the server is fully ready)
  setTimeout(() => {
    runChatUnreadNotificationTask({ log });
  }, 30_000);

  // Then every 6 hours
  const intervalId = setInterval(() => {
    runChatUnreadNotificationTask({ log });
  }, SIX_HOURS_MS);

  log.info('[chat-notify] Scheduled chat unread notification task every 6 hours.');

  return intervalId;
}

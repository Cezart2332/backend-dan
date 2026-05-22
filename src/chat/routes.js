import { requireActiveSubscription } from './middleware.js';
import {
  broadcastSystemEvent,
  getChatHistoryPage,
  handleChatSocketMessage,
  markChatAsRead,
  registerChatConnection,
  unregisterChatConnection,
} from './service.js';

const CHAT_HISTORY_LIMIT = 50;

function parseBeforeMessageId(rawBefore) {
  if (rawBefore === undefined || rawBefore === null || rawBefore === '') return null;
  const parsed = Number(rawBefore);
  if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
  return parsed;
}

/**
 * Registers subscription-gated chat routes (REST + websocket).
 *
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export async function registerChatRoutes(app) {
  app.get(
    '/chat/history',
    {
      preHandler: async (request, reply) => {
        await requireActiveSubscription(request, reply);
      },
    },
    async (request, reply) => {
      const beforeMessageId = parseBeforeMessageId(request.query?.before);
      if (Number.isNaN(beforeMessageId)) {
        return reply.code(400).send({ error: 'Parametrul before este invalid.' });
      }

      try {
        const history = await getChatHistoryPage({
          beforeMessageId,
          limit: CHAT_HISTORY_LIMIT,
        });

        return reply.send(history);
      } catch (error) {
        request.log.error({ err: error }, 'Chat history failed');
        return reply.code(500).send({ error: 'Eroare server' });
      }
    }
  );

  app.post(
    '/chat/read',
    {
      preHandler: async (request, reply) => {
        await requireActiveSubscription(request, reply);
      },
    },
    async (request, reply) => {
      try {
        const userId = request.chatUser?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Neautorizat' });
        }
        await markChatAsRead(userId);
        return reply.send({ ok: true });
      } catch (error) {
        request.log.error({ err: error }, 'Chat mark as read failed');
        return reply.code(500).send({ error: 'Eroare server' });
      }
    }
  );

  app.get(
    '/chat/connect',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        await requireActiveSubscription(request, reply, { allowQueryToken: true });
      },
    },
    (socket, request) => {
      const chatUser = request.chatUser;
      if (!chatUser?.id) {
        socket.close(1008, 'Unauthorized');
        return;
      }

      const firstConnection = registerChatConnection(chatUser, socket);
      if (firstConnection) {
        broadcastSystemEvent({ event: 'join', chatUser });
      }

      socket.on('message', async (rawData) => {
        try {
          await handleChatSocketMessage({ socket, rawData, chatUser });
        } catch (error) {
          request.log.error({ err: error, userId: chatUser.id }, 'Chat websocket message failed');
          try {
            socket.send(JSON.stringify({
              type: 'error',
              error: 'Eroare la procesarea mesajului.',
            }));
          } catch {
            // Ignore socket send failures.
          }
        }
      });

      socket.on('close', () => {
        const userWentOffline = unregisterChatConnection(chatUser, socket);
        if (userWentOffline) {
          broadcastSystemEvent({ event: 'leave', chatUser });
        }
      });

      socket.on('error', (error) => {
        request.log.warn({ err: error, userId: chatUser.id }, 'Chat websocket socket error');
      });
    }
  );
}

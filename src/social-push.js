import { sendPushToExpoTokens } from './push.js';

const PREVIEW_LENGTH = 120;

export function messagePreview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
}

// What a person sees for each social event; `actor` is the one who acted.
export function socialNotification(kind, actor, content) {
  const name = String(actor?.name || '').trim() || 'Cineva';
  const userId = String(actor?.id);
  if (kind === 'friend_request') {
    return { title: 'Cerere de prietenie', body: `${name} ți-a trimis o cerere de prietenie.`, data: { type: 'friend_request', userId } };
  }
  if (kind === 'friend_accepted') {
    return { title: 'Cerere acceptată', body: `${name} ți-a acceptat cererea de prietenie.`, data: { type: 'friend_accepted', userId, name } };
  }
  if (kind === 'private_message') {
    return { title: name, body: messagePreview(content), data: { type: 'private_message', userId, name } };
  }
  throw new Error(`Unknown social notification: ${kind}`);
}

// Sends one social push to every enabled device of `recipientId`, unless that
// person turned social notifications off. Never throws: a failed push must
// not fail the request that triggered it.
export async function notifySocial({ pool, recipientId, actorId, kind, content, log, send = sendPushToExpoTokens }) {
  try {
    const [actors] = await pool.query('/* social:push-actor */ SELECT id, name FROM users WHERE id = ?', [actorId]);
    if (!actors.length) return { sentCount: 0 };
    const [rows] = await pool.query(
      `/* social:push-tokens */ SELECT t.expo_push_token FROM user_push_tokens t
       LEFT JOIN user_notification_prefs p ON p.user_id = t.user_id
       WHERE t.user_id = ? AND t.enabled = 1 AND COALESCE(p.social_push, 1) = 1`,
      [recipientId],
    );
    if (!rows.length) return { sentCount: 0 };
    const result = await send({
      ...socialNotification(kind, actors[0], content),
      tokens: rows.map((row) => row.expo_push_token),
      channelId: 'social',
      logger: log,
    });
    if (result.invalidTokens?.length) {
      await pool.query(
        `UPDATE user_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE expo_push_token IN (${result.invalidTokens.map(() => '?').join(', ')})`,
        result.invalidTokens,
      );
    }
    return result;
  } catch (error) {
    log?.warn({ err: error, kind, recipientId }, 'Social push failed');
    return { sentCount: 0 };
  }
}

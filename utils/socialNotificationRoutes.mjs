// Where tapping a friend or private-message notification leads, and which
// notifications belong to a conversation that is already on screen.
export const SOCIAL_NOTIFICATION_TYPES = new Set(['friend_request', 'friend_accepted', 'private_message']);

const typeOf = (data) => String(data?.type || '').toLowerCase();
const userIdOf = (data) => {
  const id = Number(data?.userId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function socialNotificationTarget(data) {
  const type = typeOf(data), userId = userIdOf(data);
  if (type === 'friend_request') return { name: 'Friends' };
  if (type === 'friend_accepted' && userId) return { name: 'PublicProfile', params: { userId } };
  if (type === 'private_message' && userId) return { name: 'PrivateChat', params: { userId, name: String(data?.name || '').trim() || 'Prieten' } };
  return type === 'friend_accepted' || type === 'private_message' ? { name: 'Friends' } : null;
}

export function isPrivateMessageFrom(data, peerId) {
  return typeOf(data) === 'private_message' && peerId != null && String(userIdOf(data)) === String(peerId);
}

export function isFriendNotification(data) {
  const type = typeOf(data);
  return type === 'friend_request' || type === 'friend_accepted';
}

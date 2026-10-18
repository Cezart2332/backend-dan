import * as Notifications from 'expo-notifications';
import { isPrivateMessageFrom } from './socialNotificationRoutes.mjs';

// The private conversation currently on screen; its messages already appear
// live, so a banner for them would only interrupt.
let activePeerId = null;

export function setActivePrivateChat(peerId) {
  activePeerId = peerId == null ? null : String(peerId);
}

export function isActivePrivateChatNotification(data) {
  return isPrivateMessageFrom(data, activePeerId);
}

// Removes delivered notifications the person has now seen in the app.
export async function dismissNotificationsWhere(matches) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all((presented || [])
      .filter((item) => matches(item?.request?.content?.data || {}))
      .map((item) => Notifications.dismissNotificationAsync(item.request.identifier)));
  } catch {
    // Not available in every environment (e.g. web); nothing to clean up there.
  }
}

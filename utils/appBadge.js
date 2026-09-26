import * as Notifications from 'expo-notifications';
import { api } from './api';
import { getToken } from './authStorage';

export function setAppBadgeCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  Notifications.setBadgeCountAsync(safeCount).catch(() => {});
}

export function clearAppBadge() {
  setAppBadgeCount(0);
}

/**
 * Badge-ul de pe iconiță = notificări necitite + mesaje necitite din chat.
 * Dacă una dintre cereri eșuează, păstrăm badge-ul vechi în loc să afișăm
 * un număr greșit.
 */
export async function syncAppBadge() {
  const token = await getToken().catch(() => null);
  if (!token) {
    clearAppBadge();
    return;
  }

  const [notifications, chat] = await Promise.allSettled([
    api.getUnreadNotificationsCount(token),
    api.getChatUnreadCount(token),
  ]);
  if (notifications.status !== 'fulfilled' || chat.status !== 'fulfilled') return;

  setAppBadgeCount(
    (Number(notifications.value?.unreadCount) || 0) + (Number(chat.value?.unreadCount) || 0)
  );
}

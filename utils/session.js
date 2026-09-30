import { clearToken } from './authStorage';
import { clearUser } from './userStorage';
import { clearSubscription } from './subscriptionStorage';
import { clearEntries } from './progressStorage';
import { replaceAllRuns } from './challengeStorage';
import { logoutRevenueCatUser } from './revenuecat';
import { clearAppBadge } from './appBadge';
import { unregisterPushNotifications } from './pushRegistration';
import { stopWellbeingAccount } from './wellbeingRuntime';

/**
 * Curățenia la ieșirea din cont. Dezabonarea de la push are nevoie de
 * sesiune, așa că rulează înainte de ștergerea token-ului.
 */
export async function signOutCleanup() {
  await stopWellbeingAccount();
  await unregisterPushNotifications();
  await Promise.allSettled([
    logoutRevenueCatUser(),
    clearToken(),
    clearUser(),
    clearSubscription(),
    clearEntries(),
    replaceAllRuns([]),
  ]);
  clearAppBadge();
}

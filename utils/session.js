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
 * sesiune, așa că rulează înainte de ștergerea token-ului; cine a făcut-o deja
 * (ștergerea contului) o poate sări.
 */
export async function signOutCleanup({ skipPushUnregister = false } = {}) {
  await stopWellbeingAccount();
  if (!skipPushUnregister) await unregisterPushNotifications();
  await Promise.allSettled([logoutRevenueCatUser(), clearLocalAccountData()]);
}

/**
 * Șterge de pe telefon datele contului (sesiune, profil, abonament, jurnal,
 * provocări) și badge-ul. Folosită și când serverul a revocat deja sesiunea.
 */
export async function clearLocalAccountData() {
  await Promise.allSettled([
    clearToken(),
    clearUser(),
    clearSubscription(),
    clearEntries(),
    replaceAllRuns([]),
  ]);
  clearAppBadge();
}

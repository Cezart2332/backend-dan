import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Raportarea erorilor pornește doar în build-urile de producție și doar după
// ce `extra.SENTRY_DSN` din app.json e completat cu DSN-ul proiectului Sentry.
const DSN = String(Constants?.expoConfig?.extra?.SENTRY_DSN || '').trim();
const enabled = Boolean(DSN) && !__DEV__;

export function initMonitoring() {
  if (!enabled) return;
  Sentry.init({
    dsn: DSN,
    release: Constants?.expoConfig?.version,
    // Fără date personale (IP, cookies) și fără tracing de performanță.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

export function wrapWithMonitoring(Component) {
  return enabled ? Sentry.wrap(Component) : Component;
}

/**
 * Raportează o eroare prinsă (tratată în aplicație, dar care nu ar trebui să apară).
 *
 * @param {unknown} error
 * @param {Record<string, unknown>} [context]
 */
export function reportError(error, context) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

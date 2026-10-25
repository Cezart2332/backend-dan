import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from './userStorage';
import { api } from './api';

const KEY = 'subscription_state';

export async function saveSubscription(sub) {
  try {
    const owner = (await getUser())?.id;
    if (!owner || sub?._ownerId && String(sub._ownerId) !== String(owner)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify(sub ? { ...sub, _ownerId: String(owner) } : null));
  } catch {}
}

export async function getSubscription() {
  try {
    const owner = (await getUser())?.id;
    const raw = await AsyncStorage.getItem(KEY);
    const snapshot = raw ? JSON.parse(raw) : null;
    return owner && String(snapshot?._ownerId) === String(owner) ? snapshot : null;
  } catch { return null; }
}

export async function clearSubscription() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

/**
 * Right after sign-in, stores the server's subscription so the first screens
 * already show the right access. A failure only delays it to the next refresh.
 */
export async function cacheSubscriptionFromServer(token) {
  if (!token) return;
  try {
    const subResp = await api.getCurrentSubscription(token);
    const subscriptionType = String(subResp?.subscription?.type || '').toLowerCase();
    const isBackendTrialActive = subResp?.status === 'active' && subscriptionType === 'trial';
    await saveSubscription({
      ...(subResp.subscription || {}),
      _status: isBackendTrialActive ? 'none' : subResp.status,
      _trialEligible: subResp.trialEligible,
    });
  } catch {}
}

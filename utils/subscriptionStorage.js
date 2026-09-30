import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from './userStorage';

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

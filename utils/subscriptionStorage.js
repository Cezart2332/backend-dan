import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'subscription_state';

export async function saveSubscription(sub) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(sub || null)); } catch {}
}

export async function getSubscription() {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function clearSubscription() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'auth_user';

export async function saveUser(user) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(user || null));
  } catch {}
}

export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearUser() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

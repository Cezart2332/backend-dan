import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'challenge_runs';

export async function getRuns() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveChallengeRun(run) {
  const arr = await getRuns();
  const id = run.id || `local_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const toSave = { ...run, id };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([toSave, ...arr]));
  } catch {}
  return id;
}

export async function getRunById(id) {
  const arr = await getRuns();
  return arr.find(r => String(r.id) === String(id)) || null;
}

export async function replaceAllRuns(serverItems) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(serverItems || []));
  } catch {}
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'progress_entries_v1';
const READY_KEY = 'progress_backend_ready_v1';

function normalizeEntry(e) {
  if (!e) return null;
  return {
    id: String(e.id ?? e.localId ?? Date.now()),
    localId: e.localId ?? String(e.id ?? Date.now()),
    serverId: typeof e.serverId === 'number' ? e.serverId : null,
    date: e.date || e.client_date || e.created_at || new Date().toISOString(),
    level: Number(e.level ?? 0),
    description: e.description ?? '',
    actions: e.actions ?? '',
    synced: Boolean(e.synced ?? false),
  };
}

export async function addEntry(entry) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    const normalized = normalizeEntry({ ...entry, synced: false, serverId: null, localId: entry.id || String(Date.now()) });
    list.unshift(normalized);
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export async function getEntries() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.map(normalizeEntry) : [];
    }
    // Seed mock data on first run
    const now = Date.now();
    const mock = [
      normalizeEntry({ id: String(now - 1000 * 60 * 60 * 24 * 1), date: new Date(now - 86400000).toISOString(), level: 6, description: 'Am simțit presiune la muncă dar am respirat 4-7-8.', actions: 'Respirație 4-7-8, plimbare scurtă' }),
      normalizeEntry({ id: String(now - 1000 * 60 * 60 * 24 * 2), date: new Date(now - 2 * 86400000).toISOString(), level: 3, description: 'Zi liniștită, am meditat dimineața.', actions: 'Meditație 10 min' }),
      normalizeEntry({ id: String(now - 1000 * 60 * 60 * 24 * 3), date: new Date(now - 3 * 86400000).toISOString(), level: 8, description: 'Am avut anxietate înainte de o prezentare.', actions: 'Jurnalizare, discuție cu un prieten' }),
    ];
    await AsyncStorage.setItem(KEY, JSON.stringify(mock));
    return mock;
  } catch {
    return [];
  }
}

export async function getUnsyncedEntries() {
  const list = await getEntries();
  return list.filter((e) => !e.synced || !e.serverId);
}

export async function markEntrySynced(localId, serverId) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    const idx = list.findIndex((e) => String(e.localId || e.id) === String(localId));
    if (idx >= 0) {
      list[idx].synced = true;
      list[idx].serverId = Number(serverId);
      // Keep id aligned to server for future simplicity
      list[idx].id = String(serverId);
      await AsyncStorage.setItem(KEY, JSON.stringify(list));
    }
  } catch {}
}

export async function replaceAllWithServerEntries(serverItems) {
  try {
    const normalized = (serverItems || []).map((row) => normalizeEntry({
      id: String(row.id),
      localId: String(row.id),
      serverId: Number(row.id),
      date: row.client_date || row.created_at,
      level: row.level,
      description: row.description,
      actions: row.actions,
      synced: true,
    }));
    await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {}
}

export async function getEntryById(id) {
  try {
    const list = await getEntries();
    return list.find((e) => String(e.id) === String(id) || String(e.localId) === String(id)) || null;
  } catch {
    return null;
  }
}

export async function clearEntries() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

export async function setBackendReady(flag) {
  try { await AsyncStorage.setItem(READY_KEY, flag ? '1' : '0'); } catch {}
}

export async function isBackendReady() {
  try { return (await AsyncStorage.getItem(READY_KEY)) === '1'; } catch { return false; }
}

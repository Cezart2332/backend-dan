import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'progress_entries_v1';
// Flag from older versions, still removed at sign-out.
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

// With a serverId the entry is already on the server and is never resent.
export async function addEntry(entry, serverId = null) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    const synced = serverId != null;
    const normalized = normalizeEntry({
      ...entry,
      id: synced ? String(serverId) : entry.id,
      synced,
      serverId: synced ? Number(serverId) : null,
      localId: entry.id || String(Date.now()),
    });
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
    return [];
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

// Entries not yet sent stay on top until the next sync delivers them.
export async function replaceAllWithServerEntries(serverItems) {
  try {
    const waiting = (await getEntries()).filter((e) => !e.synced || !e.serverId);
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
    await AsyncStorage.setItem(KEY, JSON.stringify([...waiting, ...normalized]));
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
  try {
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(READY_KEY);
  } catch {}
}

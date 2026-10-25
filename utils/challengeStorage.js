import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'challenge_runs';
const LOCAL_PREFIX = 'local_';

// Writes run one after another so a sync cannot overwrite a run saved meanwhile.
let writes = Promise.resolve();
function serial(task) {
  const result = writes.then(task);
  writes = result.catch(() => {});
  return result;
}

async function writeRuns(runs) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(runs || []));
  } catch {}
}

export async function getRuns() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// What the server receives for a run; the rest is kept only on the phone.
export function challengeRunPayload(run) {
  return { challenge_id: run.challenge_id, difficulty: run.difficulty, notes: run.notes, date: run.date };
}

// A run saved without a connection keeps its local id until the server has it.
export function isUnsentRun(run) {
  return String(run?.id || '').startsWith(LOCAL_PREFIX);
}

export function saveChallengeRun(run) {
  return serial(async () => {
    const arr = await getRuns();
    const id = run.id || `${LOCAL_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await writeRuns([{ ...run, id }, ...arr]);
    return id;
  });
}

export async function getRunById(id) {
  const arr = await getRuns();
  return arr.find(r => String(r.id) === String(id)) || null;
}

export function replaceAllRuns(serverItems) {
  return serial(() => writeRuns(serverItems));
}

let sending = null;

/**
 * Sends the runs saved offline, one at a time. A run the server rejects stays
 * on the phone without holding back the others; without a connection it stops.
 *
 * @param {(run: object) => Promise<{ id?: number }>} send
 */
export function sendUnsentRuns(send) {
  if (sending) return sending;
  sending = (async () => {
    const unsent = (await getRuns()).filter(isUnsentRun);
    for (const run of unsent) {
      let res;
      try {
        res = await send(run);
      } catch (e) {
        if (e?.kind === 'rejected') continue;
        throw e;
      }
      if (res?.id == null) continue;
      await serial(async () => {
        const runs = await getRuns();
        await writeRuns(runs.map((r) => (r.id === run.id ? { ...r, id: res.id } : r)));
      });
    }
  })().finally(() => { sending = null; });
  return sending;
}

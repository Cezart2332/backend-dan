// Acknowledgements remove only the revision sent, while playback keeps writing.
export function createAudioActivityRepository({ storage, session, save, fetchStats }) {
  let writes = Promise.resolve(), syncing = null;
  const deleted = new Set();
  const key = (owner) => `audio_activity_v1:${owner}`;
  const serial = (task) => { const result = writes.then(task); writes = result.catch(() => {}); return result; };
  const read = async (owner) => { const value = await storage.getItem(key(owner)); return value ? JSON.parse(value) : { pending: {}, stats: null }; };
  const current = async (owner, token) => { const active = await session(); return !deleted.has(String(owner)) && String(active.owner) === String(owner) && active.token === token; };
  return {
    saveSnapshot(owner, snapshot) {
      return serial(async () => {
        const active = await session();
        if (deleted.has(String(owner)) || String(active.owner) !== String(owner)) return;
        const state = await read(owner);
        state.pending[snapshot.clientId] = { ...snapshot, revision: (state.pending[snapshot.clientId]?.revision || 0) + 1 };
        await storage.setItem(key(owner), JSON.stringify(state));
      });
    },
    sync() {
      if (syncing) return syncing;
      syncing = (async () => {
        const { owner, token } = await session();
        if (!owner || !token || !await current(owner, token)) return;
        const state = await serial(() => read(owner));
        for (const snapshot of Object.values(state.pending)) {
          if (!await current(owner, token)) return;
          await save(snapshot, token);
          await serial(async () => {
            if (!await current(owner, token)) return;
            const latest = await read(owner);
            if (latest.pending[snapshot.clientId]?.revision === snapshot.revision) delete latest.pending[snapshot.clientId];
            await storage.setItem(key(owner), JSON.stringify(latest));
          });
        }
      })().finally(() => { syncing = null; });
      return syncing;
    },
    async loadStats() {
      const { owner, token } = await session();
      if (!owner || !token) return { stats: null, offline: true, pending: false };
      try {
        await this.sync();
        const response = await fetchStats(token);
        if (!response.stats || !await current(owner, token)) throw new Error('Account changed');
        await serial(async () => {
          if (!await current(owner, token)) return;
          const state = await read(owner); state.stats = response.stats;
          await storage.setItem(key(owner), JSON.stringify(state));
        });
        if (!await current(owner, token)) return { stats: null, offline: true, pending: false };
        return { stats: response.stats, offline: false, pending: false };
      } catch {
        if (!await current(owner, token)) return { stats: null, offline: true, pending: false };
        const state = await serial(() => read(owner));
        return { stats: state.stats, offline: true, pending: Object.keys(state.pending).length > 0 };
      }
    },
    remove(owner) { deleted.add(String(owner)); return serial(() => storage.removeItem(key(owner))); },
  };
}

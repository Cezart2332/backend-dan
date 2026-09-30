// Serialize writes so a network acknowledgement cannot overwrite a newer local edit.
export function createWellbeingRepository(storage) {
  let chain = Promise.resolve();
  const deletedOwners = new Set();
  const key = (owner) => `wellbeing_v1:${owner}`;
  const empty = () => ({ checkins: [], sessions: [], preferences: {}, kit: { notes: '', contacts: [], favorites: [] }, access: null, reminderAnchor: null });
  async function read(owner) {
    if (!owner) throw new Error('Cont lipsă.');
    const raw = await storage.getItem(key(owner));
    if (!raw) return empty();
    const value = JSON.parse(raw);
    if (!Array.isArray(value.checkins) || !Array.isArray(value.sessions)) throw new Error('Date locale invalide.');
    return { ...empty(), ...value };
  }
  function write(owner, mutate) {
    const task = chain.then(async () => {
      if (deletedOwners.has(String(owner))) throw new Error('Datele acestui cont au fost șterse.');
      const data = await read(owner);
      const next = mutate(data);
      await storage.setItem(key(owner), JSON.stringify(next));
      return next;
    });
    chain = task.catch(() => {});
    return task;
  }
  return {
    async read(owner) { await chain; return read(owner); },
    save(owner, kind, record) {
      return write(owner, (data) => {
        const old = data[kind].find((row) => row.clientId === record.clientId);
        const next = { ...record, revision: (old?.revision ?? -1) + 1, pending: true };
        return { ...data, [kind]: [next, ...data[kind].filter((row) => row.clientId !== record.clientId)] };
      });
    },
    acknowledge(owner, kind, clientId, revision) {
      return write(owner, (data) => ({ ...data, [kind]: data[kind].map((row) => row.clientId === clientId && row.revision === revision ? { ...row, pending: false } : row) }));
    },
    merge(owner, kind, incoming) {
      return write(owner, (data) => {
        const rows = new Map(data[kind].map((row) => [row.clientId, row]));
        for (const record of incoming) {
          const local = rows.get(record.clientId);
          if (!local?.pending && (!local || record.revision >= local.revision)) rows.set(record.clientId, { ...record, pending: false });
        }
        return { ...data, [kind]: [...rows.values()] };
      });
    },
    update(owner, fields) { return write(owner, (data) => ({ ...data, ...(typeof fields === 'function' ? fields(data) : fields) })); },
    async remove(owner) { deletedOwners.add(String(owner)); await chain; await storage.removeItem(key(owner)); },
  };
}

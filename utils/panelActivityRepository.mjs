// Persistent, account-scoped events. Retry keeps the phone-generated identity.
export function createPanelActivityRepository({
  storage,
  session,
  save,
  now = Date.now,
}) {
  const key = (owner) => `panel_activity_v1:${owner}`;
  const deleted = new Set();
  let chain = Promise.resolve();
  const serial = (action) => {
    const result = chain.then(action);
    chain = result.catch(() => {});
    return result;
  };
  const read = async (owner) => {
    const raw = await storage.getItem(key(owner));
    return raw ? JSON.parse(raw) : [];
  };
  const same = async (identity) => {
    const active = await session();
    return (
      identity &&
      !deleted.has(String(identity.owner)) &&
      String(active?.owner) === String(identity.owner) &&
      active?.token === identity.token
    );
  };
  return {
    queue(identity, kind, value) {
      return serial(async () => {
        if (!(await same(identity))) return;
        const rows = await read(identity.owner);
        const id = kind === "visit" ? value.day : value.clientId;
        const old = rows.find((row) => row.kind === kind && row.id === id);
        const item = { kind, id, value: { ...old?.value, ...value } };
        const fresh = rows.filter((row) => row.kind !== kind || row.id !== id);
        await storage.setItem(
          key(identity.owner),
          JSON.stringify(
            [...fresh, item].filter(
              (row) =>
                row.kind !== "visit" ||
                Date.parse(row.value.day) > now() - 89 * 86400000,
            ),
          ),
        );
      });
    },
    flush(identity) {
      return serial(async () => {
        if (!(await same(identity))) return;
        let rows = await read(identity.owner);
        while (rows.length && (await same(identity))) {
          const row = rows[0];
          try {
            await save(row.kind, row.value, identity.token);
          } catch (error) {
            if (![400, 409].includes(error.status)) throw error;
          }
          if (!(await same(identity))) return;
          rows = rows.slice(1);
          await storage.setItem(key(identity.owner), JSON.stringify(rows));
        }
      });
    },
    remove(owner) {
      deleted.add(String(owner));
      return serial(() => storage.removeItem(key(owner)));
    },
  };
}

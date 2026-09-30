export function createWellbeingSync({ repository, api, isCurrent }) {
  return async function sync({ owner, token, generation, pull = true }) {
    const current = () => isCurrent(owner, generation);
    for (const kind of ['checkins', 'sessions']) {
      if (!current()) return;
      const data = await repository.read(owner);
      for (const row of data[kind].filter((record) => record.pending)) {
        if (!current()) return;
        await api.createWellbeing(kind, row, token);
        if (!current()) return;
        if (kind === 'sessions' && row.revision > 0) {
          await api.updateWellbeingFeedback(row.clientId, { feedback: row.feedback, revision: row.revision }, token);
          if (!current()) return;
        }
        await repository.acknowledge(owner, kind, row.clientId, row.revision);
      }
      if (!pull) continue;
      let page = 1;
      while (current()) {
        const response = await api.listWellbeing(kind, page, token);
        if (!current()) return;
        await repository.merge(owner, kind, response.items);
        if (!response.hasMore) break;
        page += 1;
      }
    }
  };
}

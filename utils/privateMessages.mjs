export function mergePrivateMessages(previous, incoming) {
  const map = new Map();
  for (const item of [...previous,...incoming]) {
    const key = `${item.senderId}:${item.clientId}`;
    const old = map.get(key);
    if (old?.id && !item.id) continue;
    map.set(key,item);
  }
  return [...map.values()].sort((a,b) => (a.id && b.id ? Number(b.id)-Number(a.id) : a.id ? 1 : b.id ? -1 : Date.parse(b.createdAt)-Date.parse(a.createdAt)));
}

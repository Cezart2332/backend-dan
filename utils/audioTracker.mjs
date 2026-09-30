// Only continuous playback contributes. Seeking and replaying the same interval
// cannot inflate the covered duration of an individual listening session.
export function createAudioTracker() {
  let last = null;
  let ranges = [];
  let ended = false;
  return {
    sample(position, now, playing, rate = 1) {
      if (!Number.isFinite(position) || !Number.isFinite(now)) return;
      if (last && last.playing) {
        const delta = position - last.position;
        const possible = Math.max(0, (now - last.now) / 1000) * rate + 0.6;
        if (delta > 0 && delta <= possible) {
          ranges.push([last.position, position]);
          ranges.sort((a, b) => a[0] - b[0]);
          const merged = [];
          for (const range of ranges) {
            const previous = merged[merged.length - 1];
            if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
            else merged.push([...range]);
          }
          ranges = merged;
        }
      }
      last = { position, now, playing };
    },
    discontinuity(position, now, playing) { last = { position, now, playing }; },
    end() { ended = true; },
    snapshot(duration) {
      const listened = ranges.reduce((sum, [from, to]) => sum + Math.max(0, Math.min(to, duration) - Math.max(from, 0)), 0);
      return { durationMs: Math.round(duration * 1000), listenedMs: Math.min(Math.round(listened * 1000), Math.round(duration * 1000)), completed: ended && duration > 0 && listened >= duration * 0.9 };
    },
  };
}

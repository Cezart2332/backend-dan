export const CONTEXTS = ['home', 'work', 'travel', 'social', 'other'];
export const LABELS = {
  home: 'Acasă', work: 'Muncă', travel: 'Deplasare', social: 'Social', other: 'Altul',
  poor: 'Slab', average: 'Mediu', good: 'Bun', none: 'Fără', some: 'Puțină', much: 'Multă',
  rest: 'Odihnă', walk: 'Plimbare', exercise: 'Mișcare', breathing: 'Respirație',
  grounding: 'Observă ce te înconjoară', helpful: 'M-a ajutat', neutral: 'Neutru', unhelpful: 'Nu m-a ajutat',
};
export const DEFAULT_PREFERENCES = { duration: 180, pattern: '4-6', sound: false, haptics: true, volume: 0.25, reminder: false };
export const GROUNDING = [
  ['5 lucruri pe care le vezi', 'Privește în jur și numește cinci lucruri.'],
  ['4 lucruri pe care le poți atinge', 'Simte, pe rând, patru lucruri: hainele, scaunul, podeaua sau un obiect apropiat.'],
  ['3 sunete pe care le auzi', 'Ascultă și numește trei sunete din jur.'],
  ['2 mirosuri pe care le observi', 'Observă două mirosuri sau amintește-ți două mirosuri familiare.'],
  ['1 gust pe care îl observi', 'Observă un gust sau amintește-ți unul familiar.'],
];

export function accessAllowed(snapshot, owner, now = Date.now(), onlineVerified = false) {
  return Boolean(owner && String(snapshot?.owner) === String(owner) && snapshot?.status === 'active'
    && ['basic', 'premium', 'vip', 'pro'].includes(snapshot?.type)
    && ((Number.isFinite(Date.parse(snapshot?.expiresAt)) && Date.parse(snapshot.expiresAt) > now)
      || (snapshot?.expiresAt == null && onlineVerified)));
}

export function breathingPhase(elapsedMs, pattern = '4-6') {
  const phases = pattern === '4-2-6' ? [['inhale', 4000], ['hold', 2000], ['exhale', 6000]] : [['inhale', 4000], ['exhale', 6000]];
  const cycleMs = phases.reduce((sum, p) => sum + p[1], 0);
  let position = Math.max(0, elapsedMs) % cycleMs;
  for (let index = 0; index < phases.length; index += 1) {
    const [name, duration] = phases[index];
    if (position < duration) return { name, duration, progress: position / duration, remaining: Math.ceil((duration - position) / 1000), key: `${Math.floor(elapsedMs / cycleMs)}:${index}` };
    position -= duration;
  }
}

// A clock based on elapsed active time; pauses never consume session time.
export function createSessionClock(durationMs, now = () => performance.now()) {
  let elapsed = 0;
  let started = null;
  return {
    resume() { if (started === null && elapsed < durationMs) started = now(); },
    pause() { if (started !== null) { elapsed = Math.min(durationMs, elapsed + Math.max(0, now() - started)); started = null; } },
    elapsed() { return Math.min(durationMs, elapsed + (started === null ? 0 : Math.max(0, now() - started))); },
    get running() { return started !== null; },
  };
}

export function reminderDate(lastCheckIn, now = new Date()) {
  const threshold = new Date(new Date(lastCheckIn).getTime() + 72 * 3600000);
  const candidate = new Date(Math.max(threshold.getTime(), now.getTime()));
  candidate.setHours(18, 0, 0, 0);
  if (candidate.getTime() < threshold.getTime() || candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

export function observedPatterns(entries) {
  if (entries.length < 10) return [];
  const results = [];
  const compare = (title, key, labels) => {
    const groups = new Map();
    for (const entry of entries) {
      const group = key(entry);
      if (!group) continue;
      const values = groups.get(group) || [];
      values.push(entry.level);
      groups.set(group, values);
    }
    const eligible = [...groups].filter(([, values]) => values.length >= 3).map(([group, values]) => ({ group, count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length }));
    eligible.sort((a, b) => b.mean - a.mean);
    if (eligible.length < 2) return;
    const high = eligible[0], low = eligible[eligible.length - 1];
    if (high.mean - low.mean < 1) return;
    results.push({ title, text: `${labels[high.group]}: medie ${high.mean.toFixed(1)}/10 (${high.count} check-in-uri). ${labels[low.group]}: ${low.mean.toFixed(1)}/10 (${low.count} check-in-uri).` });
  };
  compare('Orele raportării', (entry) => {
    const date = new Date(Date.parse(entry.occurredAt) - entry.timezoneOffset * 60000);
    const hour = date.getUTCHours();
    return hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  }, { night: 'Noaptea', morning: 'Dimineața', afternoon: 'După-amiaza', evening: 'Seara' });
  compare('Somnul raportat', (e) => e.sleep, LABELS);
  compare('Cafeina raportată', (e) => e.caffeine, LABELS);
  return results;
}

export function recommendations(sessions, checkins, now = Date.now()) {
  const latest = [...checkins].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
  const age = now - Date.parse(latest?.occurredAt);
  const context = age >= 0 && age <= 6 * 3600000 ? latest?.context : null;
  const scores = new Map();
  for (const session of sessions) {
    if (session.feedback?.rating !== 'helpful') continue;
    for (const technique of session.techniques || []) {
      const score = scores.get(technique) || { technique, matches: 0, count: 0, last: 0 };
      score.count += 1;
      if (context && session.feedback.context === context) score.matches += 1;
      score.last = Math.max(score.last, Date.parse(session.occurredAt));
      scores.set(technique, score);
    }
  }
  return [...scores.values()].sort((a, b) => b.matches - a.matches || b.count - a.count || b.last - a.last).slice(0, 3);
}

import { accessAllowed, reminderDate } from './wellbeingCore.mjs';

export function reminderPlan(data, owner, now = new Date()) {
  if (!data.preferences.reminder || !accessAllowed(data.access, owner, now.getTime())) return null;
  const latest = [...data.checkins].sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]?.occurredAt || data.reminderAnchor;
  if (!latest) return null;
  if (data.reminderScheduledFor === latest && data.reminderScheduledAt && Date.parse(data.reminderScheduledAt) <= now.getTime()) return null;
  const date = reminderDate(latest, now);
  if (date.getTime() >= Date.parse(data.access.expiresAt)) return null;
  return { anchor: latest, date, fingerprint: `${latest}:${date.getTime()}` };
}

export function createReminderScheduler({ repository, notifications, isCurrent, ensureChannel, now = () => new Date() }) {
  const identifier = 'wellbeing-checkin-reminder';
  let chain = Promise.resolve();
  function enqueue(fn) { const task = chain.then(fn); chain = task.catch(() => {}); return task; }
  return {
    cancel() { return enqueue(() => notifications.cancelScheduledNotificationAsync(identifier)); },
    schedule(owner, generation) {
      return enqueue(async () => {
        const current = () => isCurrent(owner, generation);
        if (!current()) return;
        const data = await repository.read(owner);
        const plan = reminderPlan(data, owner, now());
        if (!current()) return;
        if (!plan) { await notifications.cancelScheduledNotificationAsync(identifier); return; }
        const permission = await notifications.getPermissionsAsync();
        if (!current()) return;
        if (permission.status !== 'granted') { await notifications.cancelScheduledNotificationAsync(identifier); return; }
        const scheduled = await notifications.getAllScheduledNotificationsAsync();
        const existing = scheduled.find((item) => item.identifier === identifier);
        if (existing?.content?.data?.fingerprint === plan.fingerprint && existing.content.data.owner === owner) return;
        await notifications.cancelScheduledNotificationAsync(identifier);
        await ensureChannel();
        if (!current()) return;
        await notifications.scheduleNotificationAsync({ identifier, content: { title: 'Un moment pentru tine', body: 'Au trecut 3 zile fără check-in. Vrei un check-in de 20 de secunde?', data: { type: 'wellbeing_checkin', owner, fingerprint: plan.fingerprint }, sound: false }, trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: plan.date, channelId: 'wellbeing' } });
        if (!current()) return;
        await repository.update(owner, { reminderScheduledFor: plan.anchor, reminderScheduledAt: plan.date.toISOString() });
      });
    },
  };
}

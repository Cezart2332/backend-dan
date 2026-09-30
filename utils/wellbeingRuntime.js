import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createWellbeingRepository } from './wellbeingRepository.mjs';
import { createWellbeingSync } from './wellbeingSync.mjs';
import { createReminderScheduler } from './wellbeingReminder.mjs';
import { api } from './api';

export const wellbeingRepository = createWellbeingRepository(AsyncStorage);
let account = null;
let generation = 0;
let running = null;
const reminders = createReminderScheduler({ repository: wellbeingRepository, notifications: Notifications, isCurrent: (owner, version) => account === owner && generation === version, ensureChannel: async () => {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('wellbeing', { name: 'Check-in opțional', importance: Notifications.AndroidImportance.DEFAULT, sound: null });
} });
export function setWellbeingAccount(owner) {
  if (account !== owner) { account = owner; generation += 1; }
}
export function cancelWellbeingReminder() {
  return Platform.OS === 'web' ? Promise.resolve() : reminders.cancel();
}
export async function stopWellbeingAccount() {
  setWellbeingAccount(null);
  await cancelWellbeingReminder();
}
export function syncWellbeing(owner, token, options = {}) {
  if (!owner || !token || account !== owner) return Promise.resolve();
  if (running) return running.then(() => account === owner ? syncWellbeing(owner, token, options) : undefined);
  const sync = createWellbeingSync({ repository: wellbeingRepository, api, isCurrent: (id, version) => account === id && generation === version });
  running = sync({ owner, token, generation, ...options }).finally(() => { running = null; });
  return running;
}
export function scheduleWellbeingReminder(owner) {
  return Platform.OS === 'web' ? Promise.resolve() : reminders.schedule(owner, generation);
}

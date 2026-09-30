import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { getToken } from './authStorage';
import { getUser } from './userStorage';
import { createAudioActivityRepository } from './audioActivityRepository.mjs';

const repository = createAudioActivityRepository({
  storage: AsyncStorage,
  session: async () => ({ owner: (await getUser())?.id, token: await getToken() }),
  save: (snapshot, token) => api.saveAudioActivity(snapshot, token),
  fetchStats: (token) => api.getActivityStats(token),
});
export const saveAudioSnapshot = (owner, snapshot) => repository.saveSnapshot(owner, snapshot);
export const syncAudioActivity = () => repository.sync();
export const loadActivityStats = () => repository.loadStats();
export const deleteAudioActivity = (owner) => repository.remove(owner);
export function startAudioSync() {
  const retry = () => syncAudioActivity().catch(() => {});
  retry();
  const foreground = AppState.addEventListener('change', (state) => state === 'active' && retry());
  const network = NetInfo.addEventListener((state) => state.isConnected && retry());
  const interval = setInterval(() => AppState.currentState === 'active' && retry(), 60000);
  return () => { foreground.remove(); network(); clearInterval(interval); };
}

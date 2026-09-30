import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";
import { getUser } from "./userStorage";
import { getToken } from "./authStorage";
import { api } from "./api";
import { createPanelActivityRepository } from "./panelActivityRepository.mjs";

export async function activityIdentity() {
  const [user, token] = await Promise.all([getUser(), getToken()]);
  return user?.id && token ? { owner: String(user.id), token } : null;
}
const repository = createPanelActivityRepository({
  storage: AsyncStorage,
  session: activityIdentity,
  save: (kind, value, token) => api.savePanelActivity(kind, value, token),
});

export async function queuePanelActivity(identity, kind, value) {
  await repository.queue(identity, kind, value);
  flushPanelActivity(identity).catch(() => {});
}

export async function flushPanelActivity(identity) {
  return repository.flush(identity);
}

export function startPanelActivity() {
  let stopped = false;
  const visit = async () => {
    const identity = await activityIdentity();
    if (!stopped && identity)
      await queuePanelActivity(identity, "visit", {
        day: new Date().toISOString().slice(0, 10),
        platform: Platform.OS,
      });
  };
  visit().catch(() => {});
  const state = AppState.addEventListener("change", (value) => {
    if (value === "active") visit().catch(() => {});
  });
  const unsubscribe = NetInfo.addEventListener((value) => {
    if (value.isConnected && !stopped)
      activityIdentity()
        .then(flushPanelActivity)
        .catch(() => {});
  });
  // An app kept open overnight still records the next active day.
  const timer = setInterval(
    () => {
      if (AppState.currentState === "active") visit().catch(() => {});
    },
    15 * 60 * 1000,
  );
  return () => {
    stopped = true;
    state.remove();
    unsubscribe();
    clearInterval(timer);
  };
}
export async function removePanelActivity(owner) {
  await repository.remove(String(owner));
}

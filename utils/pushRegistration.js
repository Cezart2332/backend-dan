import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getToken } from './authStorage';
import { api } from './api';

const PUSH_TOKEN_KEY = 'expo_push_token';
// Cheia folosită înainte de centralizare (ecranele Direct/Întrebări/Webinarii).
const LEGACY_PUSH_TOKEN_KEY = 'quote_push_token';
const UNREGISTER_TIMEOUT_MS = 4000;

/**
 * Canale Android — chatul are canal separat, ca notificările de comunitate
 * să poată fi controlate independent de restul anunțurilor.
 */
export async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat comunitate',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Anunțuri',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    // Canalele lipsesc doar în medii fără suport de notificări (ex. web).
  }
}

async function registerOnce() {
  try {
    const authToken = await getToken();
    if (!authToken) return null;

    await ensureAndroidNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const expoPushToken = tokenResult?.data || null;
    if (!expoPushToken) return null;

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
    await api.registerPushToken(
      { token: expoPushToken, platform: Platform.OS, enabled: true },
      authToken
    );

    return expoPushToken;
  } catch {
    // Fără push (Expo Go vechi, emulator fără Google Play, lipsă rețea) —
    // aplicația funcționează normal, doar notificările nu ajung.
    return null;
  }
}

let registrationInFlight = null;

/**
 * Cere permisiunea de notificări și leagă token-ul Expo al telefonului de
 * contul curent. Singurul loc din aplicație care înregistrează push-ul;
 * apelurile simultane (pornire + un ecran) împart aceeași cerere.
 *
 * @returns {Promise<string|null>} token-ul Expo sau null dacă nu e disponibil.
 */
export function registerForPushNotifications() {
  if (!registrationInFlight) {
    registrationInFlight = registerOnce().finally(() => {
      registrationInFlight = null;
    });
  }
  return registrationInFlight;
}

/**
 * Dezleagă telefonul de contul curent, ca după logout să nu mai primească
 * notificările personale ale acestui cont. Trebuie apelat cât încă există
 * sesiunea (înainte de ștergerea token-ului de autentificare). Nu blochează
 * logout-ul dacă serverul nu răspunde.
 */
export async function unregisterPushNotifications() {
  try {
    const authToken = await getToken();
    if (!authToken) return;

    const expoPushToken =
      (await AsyncStorage.getItem(PUSH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_PUSH_TOKEN_KEY));
    if (!expoPushToken) return;

    await Promise.race([
      api.unregisterPushToken({ token: expoPushToken }, authToken),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    // Logout-ul continuă oricum.
  }
}

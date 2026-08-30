import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getToken } from './authStorage';
import { api } from './api';

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

/**
 * Cere permisiunea de notificări și sincronizează token-ul Expo cu serverul.
 * Rulează la pornirea aplicației pentru utilizatorii autentificați, ca push-ul
 * de chat și anunțurile să ajungă fără să fie nevoie de vreun ecran anume.
 *
 * @returns {Promise<string|null>} token-ul Expo sau null dacă nu e disponibil.
 */
export async function registerForPushNotifications() {
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

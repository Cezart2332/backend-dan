import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';

const QUOTE_NOTIFICATIONS_ENABLED_KEY = 'quote_notifications_enabled';
const QUOTE_NOTIFICATIONS_ID_KEY = 'quote_notifications_schedule_id';
const QUOTE_PUSH_TOKEN_KEY = 'quote_push_token';
const DAILY_QUOTE_HOUR = 9;
const DAILY_QUOTE_MINUTE = 0;

const QUOTES = [
  'Anxietatea scade atunci când încetezi să te mai lupți cu ea și o lași să fie.',
  'Un atac de panică este doar o furtună trecătoare – tu ești cerul care rămâne senin în spate.',
  'Curajul nu înseamnă lipsa fricii, ci alegerea de a merge înainte chiar și cu frică.',
  'Fiecare secundă în care accepți anxietatea este o secundă în care ea pierde din putere.',
  'Atacul de panică pare periculos, dar e doar o alarmă falsă. Tu ești în siguranță.',
  'Nu te teme de ceea ce simți – cu cât privești anxietatea mai direct, cu atât se dizolvă mai repede.',
  'Respiră și lasă corpul să facă ce știe el mai bine: să se liniștească singur.',
  'Anxietatea iubește lupta. Tu o învingi atunci când alegi acceptarea.',
  'Ai trecut prin atâtea până acum – asta dovedește că ești mai puternic decât crezi.',
  'Frica își pierde din intensitate când stai cu ea, nu când fugi de ea.',
  'Atacul de panică este doar o poveste spusă de creierul tău. Tu alegi dacă o crezi.',
  'Ceea ce accepți, se transformă. Ceea ce respingi, persistă.',
  'Ai voie să simți tot – și totuși să mergi mai departe.',
  'Împrietenește-te cu anxietatea și vei descoperi că nu era un dușman, ci o lecție.',
  'Cel mai greu pas e primul: să accepți că nu trebuie să controlezi totul.',
  'Ești deja pe drumul vindecării – pentru că ai ales să privești anxietatea în față.',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function QuoteOfTheDayScreen({ navigation }) {
  const [quote, setQuote] = useState(pickRandom(QUOTES));
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const syncPushTokenWithBackend = async (expoPushToken, enabled) => {
    if (!expoPushToken) return;
    const authToken = await getToken();
    if (!authToken) return;

    try {
      if (enabled) {
        await api.registerPushToken({ token: expoPushToken, platform: Platform.OS, enabled: true }, authToken);
      } else {
        await api.unregisterPushToken({ token: expoPushToken }, authToken);
      }
    } catch (error) {
      console.warn('Push token sync failed:', error?.message || error);
    }
  };

  const scheduleDailyQuoteNotification = async () => {
    const currentId = await AsyncStorage.getItem(QUOTE_NOTIFICATIONS_ID_KEY);
    if (currentId) {
      await Notifications.cancelScheduledNotificationAsync(currentId).catch(() => {});
    }

    const trigger = Platform.OS === 'android'
      ? { hour: DAILY_QUOTE_HOUR, minute: DAILY_QUOTE_MINUTE, repeats: true, channelId: 'daily' }
      : { hour: DAILY_QUOTE_HOUR, minute: DAILY_QUOTE_MINUTE, repeats: true };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gândul de azi de la Dan',
        body: 'Deschide aplicația pentru gândul de azi.',
        sound: 'default',
      },
      trigger,
    });

    await AsyncStorage.setItem(QUOTE_NOTIFICATIONS_ID_KEY, id);
  };

  const enableQuoteNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      await AsyncStorage.setItem(QUOTE_NOTIFICATIONS_ENABLED_KEY, '0');
      Alert.alert('Permisiune necesară', 'Activează notificările pentru a primi gândul zilnic.');
      setNotificationsEnabled(false);
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily', {
        name: 'Daily',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    let newPushToken = null;
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      newPushToken = tokenResult?.data || null;
      setPushToken(newPushToken);
      if (newPushToken) {
        await AsyncStorage.setItem(QUOTE_PUSH_TOKEN_KEY, newPushToken);
        await syncPushTokenWithBackend(newPushToken, true);
      }
    } catch {
      console.warn('Expo push token unavailable in this environment.');
      setPushToken(null);
    }

    await scheduleDailyQuoteNotification();
    await AsyncStorage.setItem(QUOTE_NOTIFICATIONS_ENABLED_KEY, '1');
  };

  const disableQuoteNotifications = async () => {
    const scheduledId = await AsyncStorage.getItem(QUOTE_NOTIFICATIONS_ID_KEY);
    if (scheduledId) {
      await Notifications.cancelScheduledNotificationAsync(scheduledId).catch(() => {});
      await AsyncStorage.removeItem(QUOTE_NOTIFICATIONS_ID_KEY);
    }

    const storedPushToken = (await AsyncStorage.getItem(QUOTE_PUSH_TOKEN_KEY)) || pushToken;
    if (storedPushToken) {
      await syncPushTokenWithBackend(storedPushToken, false);
    }

    await AsyncStorage.setItem(QUOTE_NOTIFICATIONS_ENABLED_KEY, '0');
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [enabledRaw, storedPushToken] = await Promise.all([
          AsyncStorage.getItem(QUOTE_NOTIFICATIONS_ENABLED_KEY),
          AsyncStorage.getItem(QUOTE_PUSH_TOKEN_KEY),
        ]);
        if (!active) return;
        if (storedPushToken) setPushToken(storedPushToken);
        setNotificationsEnabled(enabledRaw === '1');
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      if (notificationsEnabled) {
        await enableQuoteNotifications();
      } else {
        await disableQuoteNotifications();
      }
    })();
  }, [notificationsEnabled, hydrated]);

  const toggleNotifications = () => setNotificationsEnabled((v) => !v);

  const scheduleTestNotification = async () => {
    try {
      const hasPerm = await Notifications.getPermissionsAsync();
      if (hasPerm.status !== 'granted') {
        Alert.alert('Notificări dezactivate', 'Activează notificările pentru a testa.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Gândul de azi de la Dan',
          body: pickRandom(QUOTES),
        },
        trigger: { seconds: 2 },
      });
      Alert.alert('Programat', 'Notificarea de test va apărea în ~2 secunde.');
    } catch (e) {
      Alert.alert('Eroare', 'Nu am putut programa notificarea.');
      console.error(e);
    }
  };

  const refreshQuote = () => setQuote(pickRandom(QUOTES));

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <Text style={styles.title}>Gândul de azi de la Dan</Text>
            <Text style={styles.subtitle}>Un gând pentru liniște și acceptare</Text>
          </View>

          {/* Quote Card */}
          <View style={styles.card}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#2f73d8" style={{ marginBottom: 14, alignSelf: 'center' }} />
            <Text style={styles.quoteText}>{quote}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={refreshQuote}>
              <Text style={styles.refreshText}>Alt gând</Text>
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <View style={styles.notifyCard}>
            <View style={styles.notifyRow}>
              <Text style={styles.notifyTitle}>Notificări zilnice</Text>
              <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
            </View>
            <Text style={styles.notifyDesc}>Primește zilnic un gând de la Dan la 09:00 și răspunsuri când Dan îți răspunde la întrebare.</Text>
            {!!pushToken && <Text style={styles.notifyHint}>Push activ pe acest dispozitiv.</Text>}

            {/* Temporary test button (to be deleted later) */}
            <TouchableOpacity style={styles.testBtn} onPress={scheduleTestNotification}>
              <Text style={styles.testBtnText}>Testează notificarea</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="leaf-outline" size={14} color="#58718e" style={{ marginRight: 5 }} />
            <Text style={styles.footerText}>Ești în siguranță. Respirația ta e ancora ta.</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  background: { flex: 1 },
  scroll: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 10 },
  backButton: {
    position: 'absolute', left: 0, top: -2,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#18324f', marginTop: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#58718e', marginTop: 6, marginBottom: 8, textAlign: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 22, marginVertical: 12,
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)', alignItems: 'center',
  },
  quoteText: { fontSize: 17, color: '#18324f', textAlign: 'center', lineHeight: 26 },
  refreshBtn: {
    marginTop: 16, borderRadius: 12, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(47,115,216,0.18)',
    paddingVertical: 10, paddingHorizontal: 20,
  },
  refreshText: { color: '#2f73d8', fontWeight: '600', fontSize: 14 },
  notifyCard: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 18, marginTop: 8,
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
  },
  notifyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifyTitle: { fontSize: 15, fontWeight: '600', color: '#18324f' },
  notifyDesc: { fontSize: 13, color: '#58718e', marginTop: 4 },
  notifyHint: { fontSize: 12, color: '#2f73d8', marginTop: 8, fontWeight: '600' },
  testBtn: {
    marginTop: 14, borderRadius: 12, alignSelf: 'flex-start',
    backgroundColor: '#2f73d8', paddingVertical: 10, paddingHorizontal: 18,
  },
  testBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footer: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  footerText: { fontSize: 13, color: '#58718e' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';

// Configure handler so notifications show when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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

  useEffect(() => {
    // Ask for permissions when toggled on
    if (!notificationsEnabled) return;

    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permisiune necesară', 'Activează notificările pentru a primi gândul zilnic.');
        setNotificationsEnabled(false);
        return;
      }

      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('daily', {
          name: 'Daily', importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      // Token (optional): may require projectId in some setups; ignore failures
      try {
        const token = await Notifications.getExpoPushTokenAsync();
        setPushToken(token?.data || null);
      } catch (e) {
        console.warn('Expo push token unavailable in this environment.');
        setPushToken(null);
      }
    })();
  }, [notificationsEnabled]);

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
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Gândul de azi de la Dan</Text>
            <Text style={styles.subtitle}>Un gând pentru liniște și acceptare</Text>
          </View>

          {/* Quote Card */}
          <View style={styles.card}>
            <Text style={styles.quoteIcon}>💭</Text>
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
            <Text style={styles.notifyDesc}>Primește zilnic un gând de la Dan. Poți dezactiva oricând.</Text>

            {/* Temporary test button (to be deleted later) */}
            <TouchableOpacity style={styles.testBtn} onPress={scheduleTestNotification}>
              <Text style={styles.testBtnText}>Testează notificarea</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Ești în siguranță. Respirația ta e ancora ta. 🌿</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 10 },
  backButton: {
    position: 'absolute', left: 0, top: -2, padding: 8, borderRadius: 20, backgroundColor: '#fff',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  backButtonText: { fontSize: 18, color: '#4a90e2', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: '700', color: '#2c3e50', marginTop: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c7b84', marginTop: 6, marginBottom: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginVertical: 12,
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
    borderWidth: 1, borderColor: '#e8f4fd', alignItems: 'center'
  },
  quoteIcon: { fontSize: 30, marginBottom: 12 },
  quoteText: { fontSize: 18, color: '#2c3e50', textAlign: 'center', lineHeight: 26 },
  refreshBtn: {
    marginTop: 14, borderRadius: 12, overflow: 'hidden', alignSelf: 'center',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  refreshText: { paddingVertical: 12, paddingHorizontal: 18, color: '#4a90e2', fontWeight: '600' },
  notifyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8,
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: '#e8f4fd'
  },
  notifyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifyTitle: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  notifyDesc: { fontSize: 13, color: '#6c7b84', marginTop: 4 },
  testBtn: {
    marginTop: 12, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
    backgroundColor: '#4a90e2'
  },
  testBtnText: { paddingVertical: 12, paddingHorizontal: 18, color: '#fff', fontWeight: '600' },
  footer: { marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 13, color: '#6c7b84' },
});

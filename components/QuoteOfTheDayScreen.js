import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from './ui/themeContext';
import {
  disableDailyQuote,
  enableDailyQuote,
  isDailyQuoteEnabled,
  quoteForDate,
  randomQuote,
} from '../utils/dailyQuote';
import { hapticNotify, hapticSelection } from '../utils/haptics';
import { reportError } from '../utils/monitoring';

function showPermissionAlert() {
  Alert.alert(
    'Permisiune necesară',
    'Notificările sunt oprite pentru aplicație. Activează-le din setările telefonului ca să primești gândul zilnic.',
    [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Deschide setările', onPress: () => Linking.openSettings().catch(() => {}) },
    ]
  );
}

export default function QuoteOfTheDayScreen({ navigation, route }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [quote, setQuote] = useState(() => route?.params?.quote || quoteForDate());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deschis dintr-o notificare: afișează exact gândul din notificare.
  useEffect(() => {
    if (route?.params?.quote) setQuote(route.params.quote);
  }, [route?.params?.quote]);

  useEffect(() => {
    let active = true;
    isDailyQuoteEnabled()
      .then((enabled) => {
        if (active) setNotificationsEnabled(enabled);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleNotifications = useCallback(async (value) => {
    setSaving(true);
    hapticSelection();
    try {
      if (value) {
        const result = await enableDailyQuote();
        if (!result.ok) {
          setNotificationsEnabled(false);
          showPermissionAlert();
          return;
        }
        setNotificationsEnabled(true);
        hapticNotify('success');
      } else {
        await disableDailyQuote();
        setNotificationsEnabled(false);
      }
    } catch (error) {
      reportError(error, { flow: 'daily_quote_toggle', enable: value });
      setNotificationsEnabled(!value);
      Alert.alert('Eroare', `Nu am putut salva notificările zilnice.\n${error?.message || ''}`.trim());
    } finally {
      setSaving(false);
    }
  }, []);

  const refreshQuote = () => setQuote((current) => randomQuote(current));

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi" onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>
            <Text style={styles.title}>Gândul de azi de la Dan</Text>
            <Text style={styles.subtitle}>Un gând pentru liniște și acceptare</Text>
          </View>

          {/* Quote Card */}
          <View style={styles.card}>
            <Feather name="message-circle" size={30} color={tc("#24384e", 'fg')} style={{ marginBottom: 14, alignSelf: 'center' }} />
            <Text style={styles.quoteText}>{quote}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={refreshQuote}>
              <Text style={styles.refreshText}>Alt gând</Text>
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <View style={styles.notifyCard}>
            <View style={styles.notifyRow}>
              <Text style={styles.notifyTitle}>Notificări zilnice</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                disabled={!hydrated || saving}
                trackColor={{ false: tc('rgba(32,47,62,0.18)', 'bg'), true: tc('#3d7d5f', 'bg') }}
                ios_backgroundColor={tc('rgba(32,47,62,0.18)', 'bg')}
                thumbColor="#ffffff"
              />
            </View>
            <Text style={styles.notifyDesc}>Primește în fiecare dimineață, la 09:00, un gând de la Dan.</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Feather name="feather" size={14} color={tc("#5b6a7a", 'fg')} style={{ marginRight: 5 }} />
            <Text style={styles.footerText}>Ești în siguranță. Respirația ta e ancora ta.</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  background: { flex: 1 },
  scroll: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 10 },
  backButton: {
    position: 'absolute', left: 0, top: 0, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 22, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginTop: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: tc('#5b6a7a', 'fg'), marginTop: 6, marginBottom: 8, textAlign: 'center' },
  card: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 18, padding: 22, marginVertical: 12,
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'), alignItems: 'center',
  },
  quoteText: { fontSize: 17, color: tc('#1c2b3a', 'fg'), textAlign: 'center', lineHeight: 26 },
  refreshBtn: {
    marginTop: 16, borderRadius: 12, alignSelf: 'center',
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1, borderColor: tc('rgba(36,56,78,0.18)', 'bg'),
    paddingVertical: 10, paddingHorizontal: 20,
  },
  refreshText: { color: tc('#24384e', 'fg'), fontWeight: '600', fontSize: 14 },
  notifyCard: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 18, padding: 18, marginTop: 8,
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  notifyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifyTitle: { fontSize: 15, fontWeight: '600', color: tc('#1c2b3a', 'fg') },
  notifyDesc: { fontSize: 13, color: tc('#5b6a7a', 'fg'), marginTop: 4 },
  footer: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  footerText: { fontSize: 13, color: tc('#5b6a7a', 'fg') },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { registerForPushNotifications } from '../utils/pushRegistration';


function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (['scheduled', 'live', 'held', 'cancelled'].includes(normalized)) return normalized;
  return 'scheduled';
}

function statusLabel(status) {
  return {
    scheduled: 'Programat',
    live: 'Live',
    held: 'Tinut',
    cancelled: 'Anulat',
  }[normalizeStatus(status)] || 'Programat';
}

function formatWebinarDate(value) {
  if (!value) return 'Data indisponibila';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponibila';
  return date.toLocaleString('ro-RO', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WebinariiScreen({ navigation, route }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { subscription, hasProEntitlement } = useSubscription();
  const subType = String(subscription?.type || '').toLowerCase();
  const hasWebinarAccess = hasProEntitlement || ['premium', 'vip', 'pro'].includes(subType);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [pushReady, setPushReady] = useState(false);

  const focusWebinarId = useMemo(() => {
    const rawId = Number(route?.params?.focusWebinarId);
    return Number.isFinite(rawId) ? rawId : null;
  }, [route?.params?.focusWebinarId]);

  const loadWebinars = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const authToken = await getToken();
      if (!authToken) {
        setItems([]);
        setError('Autentificare necesară.');
        setAccessDenied(false);
        return;
      }

      const result = await api.listWebinars(authToken);
      setItems(Array.isArray(result?.items) ? result.items : []);
      setAccessDenied(false);
    } catch (e) {
      const message = String(e?.message || 'Nu am putut încărca webinariile.');
      setError(message);
      const denied = /premium|vip|acces disponibil/i.test(message);
      setAccessDenied(denied);
      if (denied) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWebinars();
    registerForPushNotifications().then((pushToken) => setPushReady(Boolean(pushToken)));
  }, [loadWebinars]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadWebinars({ silent: true });
    });
    return unsubscribe;
  }, [navigation, loadWebinars]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWebinars({ silent: true });
  }, [loadWebinars]);

  const openWebinarLink = useCallback(async (url) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('URL_NOT_SUPPORTED');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link invalid', 'Nu am putut deschide linkul webinarului.');
    }
  }, []);

  const renderWebinarAction = useCallback((item) => {
    if (item?.effective_link && item?.effective_link_type === 'join') {
      return (
        <TouchableOpacity style={styles.actionBtnJoin} onPress={() => openWebinarLink(item.effective_link)}>
          <Text style={styles.actionBtnText}>Intra la webinar</Text>
        </TouchableOpacity>
      );
    }

    if (item?.effective_link && item?.effective_link_type === 'recording') {
      return (
        <TouchableOpacity style={styles.actionBtnRecording} onPress={() => openWebinarLink(item.effective_link)}>
          <Text style={styles.actionBtnText}>Vezi inregistrarea</Text>
        </TouchableOpacity>
      );
    }

    const status = normalizeStatus(item?.status);
    const noLinkText =
      status === 'cancelled'
        ? 'Acest webinar a fost anulat.'
        : status === 'held'
          ? 'Inregistrarea nu este disponibila inca.'
          : 'Linkul de participare va fi publicat de Dan.';

    return <Text style={styles.noLinkText}>{noLinkText}</Text>;
  }, [openWebinarLink, styles]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi" onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
            <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Webinarii</Text>
            <Text style={styles.subtitle}>Programul live si inregistrarile disponibile</Text>
          </View>
        </View>

        {!hasWebinarAccess ? (
          <View style={styles.blockedCard}>
            <Feather name="lock" size={24} color={tc("#5c5a80", 'fg')} />
            <Text style={styles.blockedTitle}>Acces Premium/VIP</Text>
            <Text style={styles.blockedText}>
              Accesul la webinarii necesita Premium sau VIP
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => navigation.navigate('Subscriptions')}
            >
              <Text style={styles.upgradeBtnText}>Vezi abonamente</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={tc("#24384e", 'fg')} />
            <Text style={styles.loadingText}>Se încărca webinariile...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {pushReady ? (
              <View style={styles.pushInfoCard}>
                <Feather name="bell" size={16} color={tc("#16222f", 'fg')} />
                <Text style={styles.pushInfoText}>Notificarile pentru webinarii sunt active pe acest dispozitiv.</Text>
              </View>
            ) : null}

            {accessDenied ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>Accesul la webinarii necesita Premium sau VIP</Text>
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => navigation.navigate('Subscriptions')}
                >
                  <Text style={styles.upgradeBtnText}>Upgrade abonament</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error && !accessDenied ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {!items.length && !error ? (
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={22} color={tc("#8aa6c8", 'fg')} />
                <Text style={styles.emptyText}>Momentan nu exista webinarii publicate.</Text>
              </View>
            ) : null}

            {items.map((item) => {
              const status = normalizeStatus(item.status);
              const isFocused = focusWebinarId && Number(item.id) === focusWebinarId;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.webinarCard,
                    isFocused && styles.webinarCardFocused,
                  ]}
                >
                  <View style={styles.webinarTopRow}>
                    <Text style={styles.webinarTitle}>{item.title || 'Webinar'}</Text>
                    <View style={[styles.statusBadge, styles[`status_${status}`]]}>
                      <Text style={styles.statusText}>{statusLabel(status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.webinarDate}>{formatWebinarDate(item.scheduled_at)} (Europe/Bucharest)</Text>
                  {item.description ? <Text style={styles.webinarDescription}>{item.description}</Text> : null}
                  <View style={styles.actionRow}>{renderWebinarAction(item)}</View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  gradient: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 14,
  },
  headerTextWrap: { flex: 1 },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 20, fontWeight: '700', color: tc('#1c2b3a', 'fg') },
  subtitle: { fontSize: 13, color: tc('#5b6a7a', 'fg'), marginTop: 2 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: tc('#24384e', 'fg') },
  scrollContent: { paddingBottom: 20 },
  pushInfoCard: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tc('rgba(36,56,78,0.18)', 'bg'),
    backgroundColor: tc('rgba(36,56,78,0.08)', 'bg'),
    flexDirection: 'row',
    alignItems: 'center',
  },
  pushInfoText: { marginLeft: 8, color: tc('#16222f', 'fg'), fontSize: 12, flex: 1 },
  webinarCard: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  webinarCardFocused: {
    borderColor: tc('#5c5a80', 'bg'),
    shadowColor: '#5c5a80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  webinarTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  webinarTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: tc('#1c2b3a', 'fg') },
  webinarDate: { marginTop: 6, color: tc('#5b6a7a', 'fg'), fontSize: 12 },
  webinarDescription: { marginTop: 8, color: tc('#34495e', 'fg'), fontSize: 13, lineHeight: 19 },
  actionRow: { marginTop: 12 },
  actionBtnJoin: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: tc('#24384e', 'bg'),
  },
  actionBtnRecording: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: tc('#5d8f4f', 'bg'),
  },
  actionBtnText: { color: tc('#fff', 'fg'), fontWeight: '700', fontSize: 13 },
  noLinkText: { color: tc('#7d8ea1', 'fg'), fontSize: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  status_scheduled: { backgroundColor: tc('rgba(36,56,78,0.14)', 'bg') },
  status_live: { backgroundColor: tc('rgba(168,84,76,0.16)', 'bg') },
  status_held: { backgroundColor: tc('rgba(61,125,95,0.16)', 'bg') },
  status_cancelled: { backgroundColor: tc('rgba(107,118,131,0.2)', 'bg') },
  statusText: { fontSize: 11, fontWeight: '700', color: tc('#1c2b3a', 'fg') },
  blockedCard: {
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tc('rgba(92,90,128,0.24)', 'bg'),
    backgroundColor: tc('rgba(92,90,128,0.08)', 'bg'),
    alignItems: 'center',
  },
  blockedTitle: { marginTop: 8, fontSize: 17, fontWeight: '700', color: tc('#2b2f5f', 'fg') },
  blockedText: { marginTop: 6, textAlign: 'center', color: tc('#4a5d75', 'fg') },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tc('rgba(168,84,76,0.25)', 'bg'),
    backgroundColor: tc('rgba(168,84,76,0.1)', 'bg'),
    padding: 12,
    marginBottom: 10,
  },
  errorText: { color: tc('#b13f52', 'fg'), fontSize: 13 },
  emptyCard: {
    marginTop: 20,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tc('rgba(138,166,200,0.3)', 'bg'),
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    padding: 18,
  },
  emptyText: { marginTop: 8, color: tc('#5b6a7a', 'fg') },
  upgradeBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: tc('#5c5a80', 'bg'),
  },
  upgradeBtnText: { color: tc('#fff', 'fg'), fontWeight: '700' },
});

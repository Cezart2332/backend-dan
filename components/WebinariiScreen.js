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
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { useSubscription } from '../contexts/SubscriptionContext';

const SHARED_PUSH_TOKEN_KEY = 'quote_push_token';
const WEBINAR_PUSH_REGISTERED_KEY = 'webinars_push_registered_v1';

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

  const enableWebinarPush = useCallback(async () => {
    try {
      const authToken = await getToken();
      if (!authToken) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      let expoPushToken = await AsyncStorage.getItem(SHARED_PUSH_TOKEN_KEY);
      if (!expoPushToken) {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        expoPushToken = tokenResult?.data || null;
        if (expoPushToken) {
          await AsyncStorage.setItem(SHARED_PUSH_TOKEN_KEY, expoPushToken);
        }
      }

      if (!expoPushToken) return;

      await api.registerPushToken(
        { token: expoPushToken, platform: Platform.OS, enabled: true },
        authToken
      );
      await AsyncStorage.setItem(WEBINAR_PUSH_REGISTERED_KEY, '1');
      setPushReady(true);
    } catch {
      // Do not block webinar content if push registration fails.
    }
  }, []);

  const loadWebinars = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const authToken = await getToken();
      if (!authToken) {
        setItems([]);
        setError('Autentificare necesara.');
        setAccessDenied(false);
        return;
      }

      const result = await api.listWebinars(authToken);
      setItems(Array.isArray(result?.items) ? result.items : []);
      setAccessDenied(false);
    } catch (e) {
      const message = String(e?.message || 'Nu am putut incarca webinariile.');
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
    enableWebinarPush();
  }, [loadWebinars, enableWebinarPush]);

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
  }, [openWebinarLink]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#4a90e2" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Webinarii</Text>
            <Text style={styles.subtitle}>Programul live si inregistrarile disponibile</Text>
          </View>
        </View>

        {!hasWebinarAccess ? (
          <View style={styles.blockedCard}>
            <Ionicons name="lock-closed" size={24} color="#6f67ff" />
            <Text style={styles.blockedTitle}>Acces Premium/VIP</Text>
            <Text style={styles.blockedText}>
              Webinariile sunt disponibile pentru abonamente Premium si VIP.
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
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loadingText}>Se incarca webinariile...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {pushReady ? (
              <View style={styles.pushInfoCard}>
                <Ionicons name="notifications" size={16} color="#2f6cad" />
                <Text style={styles.pushInfoText}>Notificarile pentru webinarii sunt active pe acest dispozitiv.</Text>
              </View>
            ) : null}

            {accessDenied ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>Accesul la webinarii necesita Premium sau VIP.</Text>
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
                <Ionicons name="calendar-outline" size={22} color="#8aa6c8" />
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  gradient: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 14,
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a2d45' },
  subtitle: { fontSize: 13, color: '#6c8096', marginTop: 2 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: '#4a90e2' },
  scrollContent: { paddingBottom: 20 },
  pushInfoCard: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.2)',
    backgroundColor: 'rgba(74,144,226,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pushInfoText: { marginLeft: 8, color: '#2f6cad', fontSize: 12, flex: 1 },
  webinarCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,220,240,0.6)',
  },
  webinarCardFocused: {
    borderColor: '#6f67ff',
    shadowColor: '#6f67ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  webinarTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  webinarTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a2d45' },
  webinarDate: { marginTop: 6, color: '#6c8096', fontSize: 12 },
  webinarDescription: { marginTop: 8, color: '#34495e', fontSize: 13, lineHeight: 19 },
  actionRow: { marginTop: 12 },
  actionBtnJoin: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#4a90e2',
  },
  actionBtnRecording: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#5d8f4f',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  noLinkText: { color: '#7d8ea1', fontSize: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  status_scheduled: { backgroundColor: 'rgba(74,144,226,0.16)' },
  status_live: { backgroundColor: 'rgba(232,77,101,0.16)' },
  status_held: { backgroundColor: 'rgba(20,184,110,0.16)' },
  status_cancelled: { backgroundColor: 'rgba(108,128,150,0.2)' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#1a2d45' },
  blockedCard: {
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(111,103,255,0.24)',
    backgroundColor: 'rgba(111,103,255,0.08)',
    alignItems: 'center',
  },
  blockedTitle: { marginTop: 8, fontSize: 17, fontWeight: '700', color: '#2b2f5f' },
  blockedText: { marginTop: 6, textAlign: 'center', color: '#4a5d75' },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,77,101,0.25)',
    backgroundColor: 'rgba(232,77,101,0.1)',
    padding: 12,
    marginBottom: 10,
  },
  errorText: { color: '#b13f52', fontSize: 13 },
  emptyCard: {
    marginTop: 20,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138,166,200,0.3)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 18,
  },
  emptyText: { marginTop: 8, color: '#6c8096' },
  upgradeBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6f67ff',
  },
  upgradeBtnText: { color: '#fff', fontWeight: '700' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { PressableScale } from './ui';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';

const TYPE_META = {
  announcement: { icon: 'bell', label: 'Anunț' },
  question_response: { icon: 'help-circle', label: 'Răspuns întrebare' },
  webinar_created: { icon: 'cast', label: 'Webinar nou' },
  webinar_updated: { icon: 'cast', label: 'Webinar actualizat' },
  meeting_updated: { icon: 'video', label: 'Ședință' },
  chat_message: { icon: 'message-square', label: 'Comunitate' },
  chat_unread: { icon: 'message-square', label: 'Comunitate' },
};

const ROUTE_BY_TYPE = {
  question_response: 'Intrebari',
  webinar_created: 'Webinarii',
  webinar_updated: 'Webinarii',
  meeting_updated: 'Direct',
  chat_message: 'CommunityChat',
  chat_unread: 'CommunityChat',
};

function metaForType(type) {
  return TYPE_META[String(type || '').toLowerCase()] || { icon: 'bell', label: 'Notificare' };
}

function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Azi, ${timeStr}`;
  if (diffDays === 1) return `Ieri, ${timeStr}`;
  if (diffDays >= 2 && diffDays <= 6) return `Acum ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mergeNotifications(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    map.set(id, item);
  });

  return Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
}

export default function NotificationsScreen({ navigation }) {
  const isFocused = useIsFocused();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [error, setError] = useState('');

  const markedOnceRef = useRef(false);

  const load = useCallback(async ({ before = null, silent = false } = {}) => {
    const authToken = await getToken();
    if (!authToken) {
      setError('Autentificare necesară pentru notificări.');
      setLoading(false);
      setRefreshing(false);
      setLoadingOlder(false);
      return;
    }

    if (before) setLoadingOlder(true);
    else if (!silent) setLoading(true);

    try {
      const feed = await api.listNotifications(authToken, before);
      const incoming = Array.isArray(feed?.items) ? feed.items : [];
      const resolvedNextBefore = Number(feed?.nextBefore);

      setItems((prev) => (before ? mergeNotifications(prev, incoming) : mergeNotifications([], incoming)));
      setHasMore(Boolean(feed?.hasMore));
      setNextBefore(
        Number.isFinite(resolvedNextBefore) && resolvedNextBefore > 0 ? resolvedNextBefore : null
      );
      setError('');
    } catch (err) {
      setError(String(err?.message || 'Nu am putut încărca notificările.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingOlder(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const authToken = await getToken();
    if (!authToken) return;

    try {
      await api.markNotificationsRead(authToken);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
      // Marcarea ca citit se reia la următoarea deschidere a ecranului.
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    load({ before: null, silent: markedOnceRef.current }).then(() => {
      if (markedOnceRef.current) return;
      markedOnceRef.current = true;
      markAllRead();
    });
  }, [isFocused, load, markAllRead]);

  // Curăță din tray notificările deja citite aici.
  useEffect(() => {
    if (!isFocused) return;
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  }, [isFocused]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load({ before: null, silent: true }).then(() => markAllRead());
  }, [load, markAllRead]);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || loadingOlder || !nextBefore) return;
    load({ before: nextBefore });
  }, [hasMore, load, loadingOlder, nextBefore]);

  const handleItemPress = useCallback(
    (item) => {
      const route = ROUTE_BY_TYPE[String(item?.type || '').toLowerCase()];
      if (!route) return;

      if (route === 'Webinarii') {
        const webinarId = Number(item?.data?.webinarId);
        navigation.navigate('Webinarii', {
          focusWebinarId: Number.isFinite(webinarId) ? webinarId : undefined,
        });
        return;
      }

      navigation.navigate(route);
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }) => {
      const meta = metaForType(item?.type);
      const isActionable = Boolean(ROUTE_BY_TYPE[String(item?.type || '').toLowerCase()]);

      return (
        <PressableScale
          style={[styles.card, !item.read && styles.cardUnread]}
          scaleTo={isActionable ? 0.98 : 1}
          onPress={() => handleItemPress(item)}
          disabled={!isActionable}
        >
          <View style={[styles.iconRing, !item.read && styles.iconRingUnread]}>
            <Feather name={meta.icon} size={17} color={item.read ? '#5b6a7a' : '#1c2b3a'} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardLabel}>{meta.label.toUpperCase()}</Text>
              {!item.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.body}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardTime}>{formatNotificationDate(item.createdAt)}</Text>
              {isActionable ? (
                <View style={styles.cardLinkWrap}>
                  <Text style={styles.cardLink}>Deschide</Text>
                  <Feather name="chevron-right" size={13} color="#24384e" />
                </View>
              ) : null}
            </View>
          </View>
        </PressableScale>
      );
    },
    [handleItemPress]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.gradient}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <PressableScale
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
            style={styles.backBtn}
            scaleTo={0.9}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={22} color="#24384e" />
          </PressableScale>
          <View style={styles.headerTextWrap}>
            <Text style={styles.overline}>ANUNȚURI</Text>
            <Text style={styles.title}>Notificări</Text>
          </View>
          <PressableScale
            onPress={() => load({ before: null, silent: true })}
            style={styles.headerAction}
            scaleTo={0.9}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="refresh-cw" size={17} color="#24384e" />
          </PressableScale>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#24384e" />
            <Text style={styles.loaderText}>Se încarcă notificările...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={13} color="#a8544c" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <FlatList
              data={items}
              keyExtractor={(item) => `notification-${item.id}`}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#24384e" />
              }
              onEndReachedThreshold={0.4}
              onEndReached={handleLoadOlder}
              ListFooterComponent={
                loadingOlder ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color="#5b6a7a" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyRing}>
                    <Feather name="bell" size={22} color="#8a97a5" />
                  </View>
                  <Text style={styles.emptyText}>
                    Nicio notificare deocamdată.{'\n'}Aici vei găsi anunțurile lui Dan.
                  </Text>
                </View>
              }
            />
          </>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.28)',
    marginRight: 12,
  },
  headerTextWrap: { flex: 1 },
  overline: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#8a97a5',
    fontWeight: '700',
    marginBottom: 2,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.2,
    fontSize: 21,
    fontWeight: '700',
    color: '#1c2b3a',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.28)',
  },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { color: '#5b6a7a', fontSize: 13 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(168,84,76,0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  errorBannerText: { color: '#a8544c', fontSize: 12, flex: 1 },

  listContent: { paddingBottom: 28, gap: 10 },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.16)',
  },
  cardUnread: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(32,47,62,0.30)',
  },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32,47,62,0.06)',
  },
  iconRingUnread: { backgroundColor: 'rgba(32,47,62,0.12)' },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cardLabel: { fontSize: 9.5, letterSpacing: 1.2, color: '#8a97a5', fontWeight: '700' },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3d7d5f' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1c2b3a', marginBottom: 3 },
  cardText: { fontSize: 13.5, lineHeight: 19, color: '#41505f' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardTime: { fontSize: 11.5, color: '#8a97a5' },
  cardLinkWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardLink: { fontSize: 12, fontWeight: '600', color: '#24384e' },

  footerLoader: { paddingVertical: 14, alignItems: 'center' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32,47,62,0.06)',
  },
  emptyText: { color: '#5b6a7a', fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
});

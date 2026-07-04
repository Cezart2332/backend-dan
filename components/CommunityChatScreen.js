import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PressableScale } from './ui';
import { api, buildWebSocketUrl, toAbsoluteApiUrl } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';

const MAX_MESSAGE_LENGTH = 500;
const RECONNECT_DELAY_MS = 2500;
const PING_INTERVAL_MS = 25000;

function isPaidSubscriptionType(type) {
  return ['basic', 'premium', 'vip', 'pro'].includes(String(type || '').toLowerCase());
}

function toIsoDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function getMessageKey(item) {
  if (Number.isFinite(Number(item?.id)) && Number(item.id) > 0) return `id:${Number(item.id)}`;
  const type = String(item?.type || 'message').toLowerCase();
  const userId = String(item?.userId || '');
  const createdAt = toIsoDate(item?.createdAt);
  const content = String(item?.content || '').trim();
  return `${type}:${userId}:${createdAt}:${content}`;
}

function normalizeIncomingMessage(item) {
  const type = String(item?.type || '').toLowerCase();
  if (!['message', 'system'].includes(type)) return null;

  const content = String(item?.content || '').trim();
  if (!content.length) return null;

  const id = Number(item?.id);
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    localId: `${Date.now()}-${Math.random()}`,
    type,
    userId: String(item?.userId || ''),
    displayName: String(item?.displayName || 'Comunitate').trim() || 'Comunitate',
    avatar: toAbsoluteApiUrl(item?.avatar),
    content,
    createdAt: toIsoDate(item?.createdAt),
  };
}

function mergeMessages(first, second) {
  const map = new Map();
  [...first, ...second]
    .map(normalizeIncomingMessage)
    .filter(Boolean)
    .forEach((message) => {
      map.set(getMessageKey(message), message);
    });

  return Array.from(map.values()).sort((a, b) => {
    const aMs = Date.parse(a.createdAt);
    const bMs = Date.parse(b.createdAt);
    const safeA = Number.isFinite(aMs) ? aMs : 0;
    const safeB = Number.isFinite(bMs) ? bMs : 0;
    return safeA - safeB;
  });
}

function formatMessageDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today.getTime() - messageDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return timeStr;
  if (diffDays === 1) return 'ieri';
  if (diffDays >= 2 && diffDays <= 6) return diffDays + ' zile in urma';
  if (diffDays >= 7 && diffDays <= 13) return 'o saptamana in urma';
  if (diffDays >= 14 && diffDays <= 20) return '2 saptamani in urma';
  if (diffDays >= 21 && diffDays <= 27) return '3 saptamani in urma';
  if (diffDays >= 28 && diffDays <= 60) {
    const months = Math.round(diffDays / 30);
    return (months === 1 ? 'o luna' : months + ' luni') + ' in urma';
  }

  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function avatarInitial(displayName) {
  const normalized = String(displayName || '').trim();
  if (!normalized.length) return '?';
  return normalized.charAt(0).toUpperCase();
}

export default function CommunityChatScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { subscription, hasProEntitlement } = useSubscription();

  const normalizedSubType = String(subscription?.type || '').toLowerCase();
  const hasChatAccess = hasProEntitlement || isPaidSubscriptionType(normalizedSubType);

  const [currentUserId, setCurrentUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [socketError, setSocketError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const isNearBottomRef = useRef(true); // starts true so initial load scrolls to bottom
  const previousLengthRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    getUser()
      .then((user) => {
        if (!mounted) return;
        setCurrentUserId(user?.id ? String(user.id) : '');
      })
      .catch(() => {
        if (mounted) setCurrentUserId('');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const clearSocketRuntime = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        // Ignore close failures.
      }
      wsRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    const authToken = await getToken();
    if (!authToken) {
      setSocketStatus('disconnected');
      setSocketError('Autentificare necesară pentru chat.');
      return;
    }

    const wsUrl = buildWebSocketUrl('/chat/connect', authToken);
    setSocketStatus('connecting');

    const ws = new WebSocket(wsUrl, [], {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    wsRef.current = ws;

    ws.onopen = () => {
      setSocketStatus('connected');
      setSocketError('');

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState !== 1) return;
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Ignore ping failures; onclose will handle reconnect.
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event?.data || '{}');
      } catch {
        return;
      }

      const payloadType = String(payload?.type || '').toLowerCase();

      if (payloadType === 'ping') return;

      if (payloadType === 'error') {
        const errorText = String(payload?.error || 'Eroare chat.').trim();
        setSocketError(errorText || 'Eroare chat.');
        return;
      }

      if (payloadType === 'message' || payloadType === 'system') {
        setMessages((prev) => mergeMessages(prev, [payload]));
        // Mark as read when receiving new messages while screen is focused
        if (payloadType === 'message' && isFocused) {
          getToken().then((token) => {
            if (token) api.markChatAsRead(token).catch(() => {});
          });
        }
      }
    };

    ws.onerror = () => {
      setSocketStatus('error');
    };

    ws.onclose = () => {
      setSocketStatus('disconnected');

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (!shouldReconnectRef.current || !isFocused || !hasChatAccess) return;

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket().catch(() => {
          setSocketStatus('error');
        });
      }, RECONNECT_DELAY_MS);
    };
  }, [hasChatAccess, isFocused]);

  const loadHistory = useCallback(async ({ before = null, appendOlder = false } = {}) => {
    const authToken = await getToken();
    if (!authToken) {
      setHistoryError('Autentificare necesară pentru chat.');
      setMessages([]);
      setLoading(false);
      setLoadingOlder(false);
      return;
    }

    if (appendOlder) {
      setLoadingOlder(true);
      shouldAutoScrollRef.current = false;
    } else {
      setLoading(true);
      setHistoryError('');
    }

    try {
      const history = await api.getChatHistory(authToken, before);
      const incoming = Array.isArray(history?.items) ? history.items : [];
      const resolvedNextBefore = Number(history?.nextBefore);

      setHasMore(Boolean(history?.hasMore));
      setNextBefore(Number.isFinite(resolvedNextBefore) && resolvedNextBefore > 0 ? resolvedNextBefore : null);

      setMessages((prev) => {
        if (appendOlder) return mergeMessages(incoming, prev);
        return mergeMessages([], incoming);
      });
      setHistoryError('');

      if (!appendOlder) {
        // Nu blocăm afișarea istoricului dacă marcarea ca citit eșuează.
        api.markChatAsRead(authToken).catch(() => {});
      }
    } catch (error) {
      setHistoryError(String(error?.message || 'Nu am putut încărca istoricul chatului.'));
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  }, []);

  // Șterge din notification tray notificările de chat rămase după citire.
  useEffect(() => {
    if (!isFocused) return;
    Notifications.getPresentedNotificationsAsync()
      .then((presented) => Promise.all(
        (presented || [])
          .filter((n) => String(n?.request?.content?.data?.type || '').toLowerCase() === 'chat_unread')
          .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
      ))
      .catch(() => {});
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || !hasChatAccess) {
      setLoading(false);
      return;
    }

    loadHistory({ before: null, appendOlder: false })
      .catch(() => {
        setLoading(false);
      });
  }, [hasChatAccess, isFocused, loadHistory]);

  useEffect(() => {
    shouldReconnectRef.current = isFocused && hasChatAccess;

    if (!isFocused || !hasChatAccess) {
      clearSocketRuntime();
      setSocketStatus('disconnected');
      return;
    }

    connectWebSocket().catch(() => {
      setSocketStatus('error');
    });

    return () => {
      shouldReconnectRef.current = false;
      clearSocketRuntime();
    };
  }, [hasChatAccess, isFocused, connectWebSocket, clearSocketRuntime]);

  useEffect(() => {
    const grew = messages.length > previousLengthRef.current;
    if (grew && (isNearBottomRef.current || shouldAutoScrollRef.current)) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }

    previousLengthRef.current = messages.length;
    shouldAutoScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      const frameHeight = Number(event?.endCoordinates?.height || 0);
      const overlap = Platform.OS === 'ios'
        ? Math.max(0, frameHeight - insets.bottom)
        : frameHeight;

      setKeyboardHeight(overlap);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, onShow);
    const hideSubscription = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  const handleLoadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || !nextBefore) return;
    await loadHistory({ before: nextBefore, appendOlder: true });
  }, [hasMore, loadingOlder, loadHistory, nextBefore]);

  const handleSend = useCallback(() => {
    const content = String(draft || '').trim();
    if (!content.length) return;

    if (content.length > MAX_MESSAGE_LENGTH) {
      Alert.alert('Mesaj prea lung', 'Mesajul poate avea maximum 500 de caractere.');
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      Alert.alert('Conectare în curs', 'Chatul se reconectează. Încearcă din nou în câteva secunde.');
      return;
    }

    try {
      ws.send(
        JSON.stringify({
          type: 'message',
          content,
        })
      );
      setDraft('');
    } catch {
      Alert.alert('Eroare', 'Nu am putut trimite mesajul.');
    }
  }, [draft]);

  const connectionLabel = useMemo(() => {
    if (socketStatus === 'connected') return 'Conectat';
    if (socketStatus === 'connecting') return 'Conectare...';
    if (socketStatus === 'error') return 'Eroare conexiune';
    return 'Deconectat';
  }, [socketStatus]);

  const remainingChars = MAX_MESSAGE_LENGTH - String(draft || '').length;

  const renderMessageItem = useCallback(
    ({ item }) => {
      if (item.type === 'system') {
        return (
          <View style={styles.systemRow}>
            <View style={styles.systemLine} />
            <Text style={styles.systemText}>
              {item.content} · {formatMessageDate(item.createdAt)}
            </Text>
            <View style={styles.systemLine} />
          </View>
        );
      }

      const isMine = currentUserId && String(item.userId || '') === String(currentUserId);

      if (isMine) {
        return (
          <View style={styles.mineRow}>
            <View style={styles.mineBubble}>
              <Text style={styles.mineText}>{item.content}</Text>
            </View>
            <Text style={styles.mineTime}>{formatMessageDate(item.createdAt)}</Text>
          </View>
        );
      }

      return (
        <View style={styles.otherRow}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.otherAvatar} />
          ) : (
            <View style={styles.otherAvatarFallback}>
              <Text style={styles.otherAvatarInitial}>{avatarInitial(item.displayName)}</Text>
            </View>
          )}
          <View style={styles.otherContent}>
            <Text style={styles.otherName}>
              {item.displayName}
              <Text style={styles.otherTime}>  {formatMessageDate(item.createdAt)}</Text>
            </Text>
            <View style={styles.otherBubble}>
              <Text style={styles.otherText}>{item.content}</Text>
            </View>
          </View>
        </View>
      );
    },
    [currentUserId]
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
            <Text style={styles.title}>Comunitatea</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  socketStatus === 'connected' ? styles.statusDotOnline : styles.statusDotOffline,
                ]}
              />
              <Text style={styles.statusText}>{connectionLabel}</Text>
            </View>
          </View>
          {hasChatAccess ? (
            <PressableScale
              onPress={() => loadHistory({ before: null, appendOlder: false })}
              style={styles.headerAction}
              scaleTo={0.9}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="refresh-cw" size={17} color="#24384e" />
            </PressableScale>
          ) : null}
        </View>

        {!hasChatAccess ? (
          <View style={styles.blockedWrap}>
            <View style={styles.blockedRing}>
              <Feather name="lock" size={24} color="#24384e" />
            </View>
            <Text style={styles.blockedTitle}>Un loc doar al comunității</Text>
            <Text style={styles.blockedText}>
              Chat-ul este disponibil pentru abonamentele active Basic, Premium sau VIP.
            </Text>
            <PressableScale
              style={styles.blockedCta}
              onPress={() => navigation.navigate('Subscriptions')}
            >
              <Text style={styles.blockedCtaText}>Vezi abonamente</Text>
            </PressableScale>
          </View>
        ) : loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#24384e" />
            <Text style={styles.loaderText}>Se încarcă mesajele...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={0}
          >
            {historyError ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={13} color="#a8544c" />
                <Text style={styles.errorBannerText}>{historyError}</Text>
              </View>
            ) : null}

            {socketError ? (
              <View style={[styles.errorBanner, styles.warnBanner]}>
                <Feather name="wifi-off" size={13} color="#9a6a14" />
                <Text style={[styles.errorBannerText, styles.warnBannerText]}>{socketError}</Text>
              </View>
            ) : null}

            {hasMore ? (
              <TouchableOpacity
                style={[styles.loadOlderBtn, loadingOlder && styles.loadOlderBtnDisabled]}
                onPress={handleLoadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" color="#5b6a7a" />
                ) : (
                  <Text style={styles.loadOlderText}>Mesaje anterioare</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => (item.id ? `id-${item.id}` : `local-${item.localId || getMessageKey(item)}`)}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (isNearBottomRef.current || shouldAutoScrollRef.current) {
                  listRef.current?.scrollToEnd({ animated: false });
                }
              }}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const paddingToBottom = 60;
                const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
                isNearBottomRef.current = isNearBottom;
                setShowScrollDown(!isNearBottom && contentSize.height > layoutMeasurement.height);
              }}
              scrollEventThrottle={200}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyRing}>
                    <Feather name="message-circle" size={22} color="#8a97a5" />
                  </View>
                  <Text style={styles.emptyText}>Liniște deocamdată.{'\n'}Scrie primul mesaj.</Text>
                </View>
              }
            />

            {showScrollDown ? (
              <PressableScale
                style={styles.scrollDownBtn}
                scaleTo={0.9}
                onPress={() => {
                  listRef.current?.scrollToEnd({ animated: true });
                  isNearBottomRef.current = true;
                  shouldAutoScrollRef.current = true;
                  setShowScrollDown(false);
                  getToken().then((token) => {
                    if (token) api.markChatAsRead(token).catch(() => {});
                  });
                }}
              >
                <Feather name="chevron-down" size={18} color="#fff" />
              </PressableScale>
            ) : null}

            {/* ── Composer ── */}
            <View
              style={[
                styles.composerWrap,
                {
                  paddingBottom:
                    Math.max(insets.bottom, 6) + (Platform.OS === 'ios' ? keyboardHeight : 0),
                },
              ]}
            >
              <View style={styles.composerPill}>
                <TextInput
                  style={styles.input}
                  placeholder="Scrie un mesaj..."
                  placeholderTextColor="#8a97a5"
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      listRef.current?.scrollToEnd({ animated: true });
                    });
                  }}
                  multiline
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                {remainingChars < 60 ? (
                  <Text style={styles.counterText}>{Math.max(0, remainingChars)}</Text>
                ) : null}
                <PressableScale
                  style={[styles.sendBtn, !String(draft || '').trim().length && styles.sendBtnIdle]}
                  onPress={handleSend}
                  scaleTo={0.88}
                >
                  <Feather name="arrow-up" size={18} color="#fff" />
                </PressableScale>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
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
    zIndex: 10,
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.2,
    fontSize: 21,
    fontWeight: '700',
    color: '#1c2b3a',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusDotOnline: { backgroundColor: '#3d7d5f' },
  statusDotOffline: { backgroundColor: '#9aa5b1' },
  statusText: { color: '#5b6a7a', fontSize: 11.5, fontWeight: '500' },
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

  // Gate
  blockedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  blockedRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.28)',
    marginBottom: 18,
  },
  blockedTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#1c2b3a',
    textAlign: 'center',
  },
  blockedText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#5b6a7a',
    fontSize: 13.5,
    lineHeight: 20,
  },
  blockedCta: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(28,43,58,0.92)',
  },
  blockedCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 8, color: '#5b6a7a' },

  chatContainer: { flex: 1 },

  // Bannere
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,84,76,0.35)',
    backgroundColor: 'rgba(168,84,76,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorBannerText: { color: '#a8544c', fontSize: 12, flex: 1 },
  warnBanner: {
    borderColor: 'rgba(179,146,79,0.4)',
    backgroundColor: 'rgba(179,146,79,0.07)',
  },
  warnBannerText: { color: '#9a6a14' },

  loadOlderBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.25)',
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 10,
  },
  loadOlderBtnDisabled: { opacity: 0.7 },
  loadOlderText: {
    color: '#5b6a7a',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  listContent: { paddingBottom: 10, paddingTop: 2 },

  // Empty
  emptyWrap: { alignItems: 'center', marginTop: 48 },
  emptyRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.24)',
    marginBottom: 12,
  },
  emptyText: { textAlign: 'center', color: '#8a97a5', fontSize: 13, lineHeight: 20 },

  // Mesaje de sistem
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '92%',
    gap: 10,
    marginVertical: 10,
  },
  systemLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(32,47,62,0.22)',
    minWidth: 18,
  },
  systemText: {
    color: '#8a97a5',
    fontSize: 11,
    textAlign: 'center',
    flexShrink: 1,
  },

  // Mesajele mele
  mineRow: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  mineBubble: {
    backgroundColor: 'rgba(28,43,58,0.92)',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mineText: { color: '#f6f7f8', fontSize: 14.5, lineHeight: 20 },
  mineTime: { color: '#9aa5b1', fontSize: 10, marginTop: 4, marginRight: 4 },

  // Mesajele altora
  otherRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '86%',
    marginBottom: 10,
  },
  otherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.3)',
  },
  otherAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.3)',
  },
  otherAvatarInitial: { fontSize: 11, color: '#24384e', fontWeight: '700' },
  otherContent: { flexShrink: 1 },
  otherName: {
    color: '#8a97a5',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    marginLeft: 4,
  },
  otherTime: { color: '#b6bfc9', fontWeight: '400', fontSize: 10 },
  otherBubble: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.24)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  otherText: { color: '#1c2b3a', fontSize: 14.5, lineHeight: 20 },

  // Composer
  composerWrap: {
    marginTop: 6,
    paddingTop: 4,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32,47,62,0.3)',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    color: '#1c2b3a',
    fontSize: 14.5,
    textAlignVertical: 'center',
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: 6,
  },
  counterText: {
    alignSelf: 'center',
    color: '#8a97a5',
    fontSize: 10,
    marginHorizontal: 6,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(28,43,58,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnIdle: { opacity: 0.45 },
  scrollDownBtn: {
    position: 'absolute',
    bottom: 92,
    right: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(28,43,58,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});

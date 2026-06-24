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
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useSubscription } from '../contexts/SubscriptionContext';
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
        await api.markChatAsRead(authToken);
      }
    } catch (error) {
      setHistoryError(String(error?.message || 'Nu am putut încărca istoricul chatului.'));
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  }, []);

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
            <Text style={styles.systemText}>{item.content}</Text>
            <Text style={styles.systemTime}>{formatMessageDate(item.createdAt)}</Text>
          </View>
        );
      }

      const isMine = currentUserId && String(item.userId || '') === String(currentUserId);

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
          {!isMine ? (
            <View style={styles.senderRow}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.senderAvatar} />
              ) : (
                <View style={styles.senderAvatarFallback}>
                  <Text style={styles.senderAvatarFallbackText}>{avatarInitial(item.displayName)}</Text>
                </View>
              )}
              <Text style={styles.senderText}>{item.displayName}</Text>
            </View>
          ) : null}
          <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
              {item.content}
            </Text>
          </View>
          <Text style={styles.messageTime}>{formatMessageDate(item.createdAt)}</Text>
        </View>
      );
    },
    [currentUserId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.gradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#2f73d8" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Comunitate chat</Text>
            <Text style={styles.subtitle}>Doar pentru utilizatorii cu abonament activ</Text>
          </View>
        </View>

        {!hasChatAccess ? (
          <View style={styles.blockedCard}>
            <Ionicons name="lock-closed" size={24} color="#6f67ff" />
            <Text style={styles.blockedTitle}>Acces cu abonament activ</Text>
            <Text style={styles.blockedText}>
              Chat-ul comunitatii este disponibil doar pentru abonamente active Basic, Premium sau VIP.
            </Text>
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => navigation.navigate('Subscriptions')}>
              <Text style={styles.upgradeBtnText}>Vezi abonamente</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#2f73d8" />
            <Text style={styles.loaderText}>Se încărca mesajele...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={styles.statusBarRow}>
              <View style={[styles.statusBadge, socketStatus === 'connected' ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
                <View style={[styles.statusDot, socketStatus === 'connected' ? styles.statusDotOnline : styles.statusDotOffline]} />
                <Text style={styles.statusText}>{connectionLabel}</Text>
              </View>

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => loadHistory({ before: null, appendOlder: false })}
                activeOpacity={0.75}
              >
                <Ionicons name="refresh" size={16} color="#2158ad" />
                <Text style={styles.refreshBtnText}>Actualizeaza</Text>
              </TouchableOpacity>
            </View>

            {historyError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{historyError}</Text>
              </View>
            ) : null}

            {socketError ? (
              <View style={styles.errorCardSecondary}>
                <Text style={styles.errorTextSecondary}>{socketError}</Text>
              </View>
            ) : null}

            {hasMore ? (
              <TouchableOpacity
                style={[styles.loadOlderBtn, loadingOlder && styles.loadOlderBtnDisabled]}
                onPress={handleLoadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" color="#2158ad" />
                ) : (
                  <Text style={styles.loadOlderText}>Incarca mesaje anterioare</Text>
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
              ListEmptyComponent={<Text style={styles.emptyText}>Nu exista mesaje inca. Scrie primul mesaj.</Text>}
            />

            {showScrollDown ? (
              <TouchableOpacity
                style={styles.scrollDownBtn}
                onPress={() => {
                  listRef.current?.scrollToEnd({ animated: true });
                  isNearBottomRef.current = true;
                  shouldAutoScrollRef.current = true;
                  setShowScrollDown(false);
                  getToken().then((token) => {
                    if (token) api.markChatAsRead(token).catch(() => {});
                  });
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-down" size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}

            <View
              style={[
                styles.composerWrap,
                {
                  paddingBottom:
                    Math.max(insets.bottom, 6) + (Platform.OS === 'ios' ? keyboardHeight : 0),
                },
              ]}
            >
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Scrie un mesaj pentru comunitate..."
                  placeholderTextColor="#8ea0b2"
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
                <Text style={styles.counterText}>{Math.max(0, remainingChars)}</Text>
              </View>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 12,
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#18324f' },
  subtitle: { fontSize: 12, color: '#58718e', marginTop: 2 },

  blockedCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(111,103,255,0.24)',
    backgroundColor: 'rgba(111,103,255,0.08)',
    alignItems: 'center',
  },
  blockedTitle: { marginTop: 8, fontSize: 17, fontWeight: '700', color: '#2b2f5f' },
  blockedText: { marginTop: 6, textAlign: 'center', color: '#4a5d75' },
  upgradeBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6f67ff',
  },
  upgradeBtnText: { color: '#fff', fontWeight: '700' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 8, color: '#2f73d8' },

  chatContainer: { flex: 1 },
  statusBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeOnline: {
    backgroundColor: 'rgba(46, 174, 99, 0.12)',
    borderColor: 'rgba(46, 174, 99, 0.3)',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(108, 128, 150, 0.12)',
    borderColor: 'rgba(108, 128, 150, 0.22)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  statusDotOnline: { backgroundColor: '#2eae63' },
  statusDotOffline: { backgroundColor: '#8aa0b6' },
  statusText: { color: '#2d4257', fontWeight: '600', fontSize: 12 },

  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(47,108,173,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  refreshBtnText: { marginLeft: 6, color: '#2158ad', fontSize: 12, fontWeight: '600' },

  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(232,77,101,0.22)',
    backgroundColor: 'rgba(232,77,101,0.1)',
    padding: 10,
    marginBottom: 8,
  },
  errorText: { color: '#a74457', fontSize: 12 },
  errorCardSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 10,
    marginBottom: 8,
  },
  errorTextSecondary: { color: '#9a6a14', fontSize: 12 },

  loadOlderBtn: {
    alignSelf: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(47,115,216,0.2)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  loadOlderBtnDisabled: { opacity: 0.7 },
  loadOlderText: { color: '#2158ad', fontWeight: '600', fontSize: 12 },

  listContent: { paddingBottom: 10 },
  emptyText: { textAlign: 'center', color: '#58718e', marginTop: 20 },

  systemRow: {
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: 'rgba(108,128,150,0.16)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  systemText: { color: '#4e6479', fontSize: 12, textAlign: 'center' },
  systemTime: { color: '#8094a6', fontSize: 10, marginTop: 2, textAlign: 'center' },

  messageRow: { maxWidth: '85%', marginBottom: 8 },
  messageRowMine: { alignSelf: 'flex-end' },
  messageRowOther: { alignSelf: 'flex-start' },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    marginLeft: 2,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(160,188,214,0.55)',
  },
  senderAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,115,216,0.14)',
  },
  senderAvatarFallbackText: {
    fontSize: 10,
    color: '#3b6797',
    fontWeight: '700',
  },
  senderText: { color: '#5f7690', fontSize: 11 },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  messageBubbleMine: {
    backgroundColor: '#2f73d8',
    borderColor: 'rgba(44,110,187,0.6)',
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: 'rgba(117,154,194,0.22)',
  },
  messageText: { fontSize: 14, lineHeight: 19 },
  messageTextMine: { color: '#fff' },
  messageTextOther: { color: '#18324f' },
  messageTime: { color: '#8397a8', fontSize: 10, marginTop: 3, marginHorizontal: 4 },

  composerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(180,205,230,0.45)',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(180,205,230,0.65)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  input: {
    minHeight: 40,
    maxHeight: 110,
    color: '#18324f',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  counterText: {
    alignSelf: 'flex-end',
    color: '#8da0b1',
    fontSize: 10,
    marginTop: 2,
  },
  sendBtn: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2f73d8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2f73d8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollDownBtn: {
    position: 'absolute',
    bottom: 100,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2f73d8',
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

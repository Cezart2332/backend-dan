import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { api, buildWebSocketUrl } from '../utils/api';
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
    avatar: null,
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

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommunityChatScreen({ navigation }) {
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

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
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
      setSocketError('Autentificare necesara pentru chat.');
      return;
    }

    const wsUrl = buildWebSocketUrl('/chat/connect');
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
      setHistoryError('Autentificare necesara pentru chat.');
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
    } catch (error) {
      setHistoryError(String(error?.message || 'Nu am putut incarca istoricul chatului.'));
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

    loadHistory({ before: null, appendOlder: false }).catch(() => {
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
    if (grew && shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }

    previousLengthRef.current = messages.length;
    shouldAutoScrollRef.current = true;
  }, [messages]);

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
      Alert.alert('Conectare in curs', 'Chatul se reconecteaza. Incearca din nou in cateva secunde.');
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
            <Text style={styles.systemTime}>{formatTime(item.createdAt)}</Text>
          </View>
        );
      }

      const isMine = currentUserId && String(item.userId || '') === String(currentUserId);

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
          {!isMine ? <Text style={styles.senderText}>{item.displayName}</Text> : null}
          <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
              {item.content}
            </Text>
          </View>
          <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
        </View>
      );
    },
    [currentUserId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.gradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#4a90e2" />
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
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loaderText}>Se incarca mesajele...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
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
                <Ionicons name="refresh" size={16} color="#2f6cad" />
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
                  <ActivityIndicator size="small" color="#2f6cad" />
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
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyText}>Nu exista mesaje inca. Scrie primul mesaj.</Text>}
            />

            <View style={styles.composerWrap}>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Scrie un mesaj pentru comunitate..."
                  placeholderTextColor="#8ea0b2"
                  value={draft}
                  onChangeText={setDraft}
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
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
    marginRight: 12,
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a2d45' },
  subtitle: { fontSize: 12, color: '#6c8096', marginTop: 2 },

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
  loaderText: { marginTop: 8, color: '#4a90e2' },

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
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  refreshBtnText: { marginLeft: 6, color: '#2f6cad', fontSize: 12, fontWeight: '600' },

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
    borderColor: 'rgba(74,144,226,0.25)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  loadOlderBtnDisabled: { opacity: 0.7 },
  loadOlderText: { color: '#2f6cad', fontWeight: '600', fontSize: 12 },

  listContent: { paddingBottom: 10 },
  emptyText: { textAlign: 'center', color: '#6c8096', marginTop: 20 },

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
  senderText: { color: '#5f7690', fontSize: 11, marginBottom: 3, marginLeft: 4 },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  messageBubbleMine: {
    backgroundColor: '#4a90e2',
    borderColor: 'rgba(44,110,187,0.6)',
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: 'rgba(200,220,240,0.65)',
  },
  messageText: { fontSize: 14, lineHeight: 19 },
  messageTextMine: { color: '#fff' },
  messageTextOther: { color: '#1a2d45' },
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
    color: '#1a2d45',
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
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
});

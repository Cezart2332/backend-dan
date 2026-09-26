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
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { PressableScale } from './ui';
import { api, buildWebSocketUrl, toAbsoluteApiUrl } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';
import { syncAppBadge } from '../utils/appBadge';
import { hapticImpact, hapticNotify } from '../utils/haptics';
import { useTheme, useThemedStyles } from './ui/themeContext';

const MAX_MESSAGE_LENGTH = 2000;
const RECONNECT_DELAY_MS = 2500;
const PING_INTERVAL_MS = 25000;
const SEND_TIMEOUT_MS = 12000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const CHAT_NOTIFICATION_TYPES = new Set(['chat_message', 'chat_unread']);

function createClientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function dayKeyOf(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Azi';
  if (diffDays === 1) return 'Ieri';

  const label = date.toLocaleDateString(
    'ro-RO',
    date.getFullYear() === now.getFullYear()
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSameGroup(previous, current) {
  if (!previous || !current) return false;
  if (previous.type !== 'message' || current.type !== 'message') return false;
  if (String(previous.userId) !== String(current.userId)) return false;
  if (dayKeyOf(previous.createdAt) !== dayKeyOf(current.createdAt)) return false;
  const gap = Date.parse(current.createdAt) - Date.parse(previous.createdAt);
  return Number.isFinite(gap) && gap <= GROUP_WINDOW_MS;
}

// Intercalează separatoare de zi și marchează începutul/sfârșitul fiecărui
// grup de mesaje consecutive ale aceleiași persoane.
function buildListItems(messages) {
  const items = [];
  let previousDayKey = null;

  messages.forEach((message, index) => {
    const dayKey = dayKeyOf(message.createdAt);
    if (dayKey !== previousDayKey) {
      items.push({ kind: 'day', key: `day-${dayKey}`, label: formatDayLabel(message.createdAt) });
      previousDayKey = dayKey;
    }

    const previous = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    items.push({
      kind: 'message',
      key: message.pending
        ? `pending-${message.clientId}`
        : message.id
          ? `id-${message.id}`
          : `local-${message.localId || getMessageKey(message)}`,
      message,
      isFirstInGroup: !isSameGroup(previous, message),
      isLastInGroup: !isSameGroup(message, next),
    });
  });

  return items;
}

function avatarInitial(displayName) {
  const normalized = String(displayName || '').trim();
  if (!normalized.length) return '?';
  return normalized.charAt(0).toUpperCase();
}

export default function CommunityChatScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

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
  const [onlineCount, setOnlineCount] = useState(null);
  const [pending, setPending] = useState([]);

  const pendingTimersRef = useRef(new Map());
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

  const clearPendingTimer = useCallback((clientId) => {
    const timer = pendingTimersRef.current.get(clientId);
    if (timer) clearTimeout(timer);
    pendingTimersRef.current.delete(clientId);
  }, []);

  const markPendingFailed = useCallback((clientId) => {
    clearPendingTimer(clientId);
    setPending((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, status: 'failed' } : item))
    );
  }, [clearPendingTimer]);

  const resolvePending = useCallback((clientId) => {
    clearPendingTimer(clientId);
    setPending((prev) => prev.filter((item) => item.clientId !== clientId));
  }, [clearPendingTimer]);

  const startPendingTimer = useCallback((clientId) => {
    clearPendingTimer(clientId);
    pendingTimersRef.current.set(
      clientId,
      setTimeout(() => {
        pendingTimersRef.current.delete(clientId);
        setPending((prev) =>
          prev.map((item) =>
            item.clientId === clientId && item.status === 'sending' ? { ...item, status: 'failed' } : item
          )
        );
      }, SEND_TIMEOUT_MS)
    );
  }, [clearPendingTimer]);

  useEffect(() => {
    const timers = pendingTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
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

      if (payloadType === 'presence') {
        const online = Number(payload?.online);
        setOnlineCount(Number.isFinite(online) && online >= 0 ? online : null);
        return;
      }

      if (payloadType === 'error') {
        const errorText = String(payload?.error || 'Eroare chat.').trim();
        setSocketError(errorText || 'Eroare chat.');
        if (payload?.clientId) {
          markPendingFailed(String(payload.clientId));
          hapticNotify('error');
        }
        return;
      }

      if (payloadType === 'message' || payloadType === 'system') {
        if (payload?.clientId) {
          resolvePending(String(payload.clientId));
          setSocketError('');
        }
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

      if (!shouldReconnectRef.current || !isFocused) return;

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket().catch(() => {
          setSocketStatus('error');
        });
      }, RECONNECT_DELAY_MS);
    };
  }, [isFocused, markPendingFailed, resolvePending]);

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
        api.markChatAsRead(authToken).then(syncAppBadge).catch(() => {});
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
          .filter((n) =>
            CHAT_NOTIFICATION_TYPES.has(String(n?.request?.content?.data?.type || '').toLowerCase())
          )
          .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
      ))
      .catch(() => {});
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      setLoading(false);
      return;
    }

    loadHistory({ before: null, appendOlder: false })
      .catch(() => {
        setLoading(false);
      });
  }, [isFocused, loadHistory]);

  useEffect(() => {
    shouldReconnectRef.current = isFocused;

    if (!isFocused) {
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
  }, [isFocused, connectWebSocket, clearSocketRuntime]);

  const listItems = useMemo(() => {
    const pendingMessages = pending.map((item) => ({
      type: 'message',
      pending: true,
      clientId: item.clientId,
      status: item.status,
      userId: currentUserId,
      content: item.content,
      createdAt: item.createdAt,
    }));
    return buildListItems([...messages, ...pendingMessages]);
  }, [messages, pending, currentUserId]);

  useEffect(() => {
    const grew = listItems.length > previousLengthRef.current;
    if (grew && (isNearBottomRef.current || shouldAutoScrollRef.current)) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }

    previousLengthRef.current = listItems.length;
    shouldAutoScrollRef.current = false;
  }, [listItems]);

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
      Alert.alert('Mesaj prea lung', `Mesajul poate avea maximum ${MAX_MESSAGE_LENGTH} de caractere.`);
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      Alert.alert('Conectare în curs', 'Chatul se reconectează. Încearcă din nou în câteva secunde.');
      return;
    }

    const clientId = createClientId();
    try {
      ws.send(JSON.stringify({ type: 'message', content, clientId }));
    } catch {
      Alert.alert('Eroare', 'Nu am putut trimite mesajul.');
      return;
    }

    // Mesajul apare imediat; se confirmă când serverul îl trimite înapoi
    // cu același clientId, altfel devine „netrimis” și poate fi reîncercat.
    setPending((prev) => [
      ...prev,
      { clientId, content, createdAt: new Date().toISOString(), status: 'sending' },
    ]);
    startPendingTimer(clientId);
    shouldAutoScrollRef.current = true;
    setDraft('');
    hapticImpact('light');
  }, [draft, startPendingTimer]);

  const retryPending = useCallback((item) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      Alert.alert('Conectare în curs', 'Chatul se reconectează. Încearcă din nou în câteva secunde.');
      return;
    }

    try {
      ws.send(JSON.stringify({ type: 'message', content: item.content, clientId: item.clientId }));
    } catch {
      Alert.alert('Eroare', 'Nu am putut trimite mesajul.');
      return;
    }

    setPending((prev) =>
      prev.map((entry) => (entry.clientId === item.clientId ? { ...entry, status: 'sending' } : entry))
    );
    startPendingTimer(item.clientId);
    hapticImpact('light');
  }, [startPendingTimer]);

  const handleFailedPress = useCallback((item) => {
    Alert.alert('Mesaj netrimis', 'Mesajul nu a ajuns în comunitate.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => resolvePending(item.clientId) },
      { text: 'Reîncearcă', onPress: () => retryPending(item) },
    ]);
  }, [resolvePending, retryPending]);

  const connectionLabel = useMemo(() => {
    if (socketStatus === 'connected') {
      return onlineCount ? `Conectat · ${onlineCount} online` : 'Conectat';
    }
    if (socketStatus === 'connecting') return 'Conectare...';
    if (socketStatus === 'error') return 'Eroare conexiune';
    return 'Deconectat';
  }, [socketStatus, onlineCount]);

  const remainingChars = MAX_MESSAGE_LENGTH - String(draft || '').length;

  const renderMessageItem = useCallback(
    ({ item: row }) => {
      if (row.kind === 'day') {
        return (
          <View style={styles.dayRow}>
            <Text style={styles.dayText}>{row.label}</Text>
          </View>
        );
      }

      const { message: item, isFirstInGroup, isLastInGroup } = row;

      if (item.type === 'system') {
        return (
          <View style={styles.systemRow}>
            <View style={styles.systemLine} />
            <Text style={styles.systemText}>
              {item.content} · {formatMessageTime(item.createdAt)}
            </Text>
            <View style={styles.systemLine} />
          </View>
        );
      }

      const isMine =
        item.pending || (currentUserId && String(item.userId || '') === String(currentUserId));

      if (isMine) {
        const isFailed = item.pending && item.status === 'failed';
        const isSending = item.pending && item.status === 'sending';
        const bubble = (
          <View
            style={[
              styles.mineBubble,
              isLastInGroup && styles.mineBubbleTail,
              isSending && styles.mineBubbleSending,
              isFailed && styles.mineBubbleFailed,
            ]}
          >
            <Text style={styles.mineText}>{item.content}</Text>
          </View>
        );

        return (
          <View style={[styles.mineRow, isLastInGroup ? styles.groupEnd : styles.groupInner]}>
            {isFailed ? (
              <PressableScale onPress={() => handleFailedPress(item)} scaleTo={0.97}>
                {bubble}
              </PressableScale>
            ) : (
              bubble
            )}
            {isFailed ? (
              <View style={styles.mineStatusRow}>
                <Feather name="alert-circle" size={11} color={tc("#a8544c", 'fg')} />
                <Text style={styles.failedText}>Netrimis · atinge pentru opțiuni</Text>
              </View>
            ) : isSending ? (
              <View style={styles.mineStatusRow}>
                <Feather name="clock" size={10} color={tc("#9aa5b1", 'fg')} />
                <Text style={styles.mineStatusText}>Se trimite…</Text>
              </View>
            ) : isLastInGroup ? (
              <Text style={styles.mineTime}>{formatMessageTime(item.createdAt)}</Text>
            ) : null}
          </View>
        );
      }

      return (
        <View style={[styles.otherRow, isLastInGroup ? styles.groupEnd : styles.groupInner]}>
          {!isFirstInGroup ? (
            <View style={styles.otherAvatarSpacer} />
          ) : item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.otherAvatar} />
          ) : (
            <View style={styles.otherAvatarFallback}>
              <Text style={styles.otherAvatarInitial}>{avatarInitial(item.displayName)}</Text>
            </View>
          )}
          <View style={styles.otherContent}>
            {isFirstInGroup ? (
              <Text style={styles.otherName}>
                {item.displayName}
                <Text style={styles.otherTime}>  {formatMessageTime(item.createdAt)}</Text>
              </Text>
            ) : null}
            <View style={[styles.otherBubble, isFirstInGroup && styles.otherBubbleTail]}>
              <Text style={styles.otherText}>{item.content}</Text>
            </View>
          </View>
        </View>
      );
    },
    [currentUserId, handleFailedPress, styles, tc]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.gradient}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Înapoi"
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
            style={styles.backBtn}
            scaleTo={0.9}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
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
          <PressableScale accessibilityRole="button" accessibilityLabel="Reîncarcă"
            onPress={() => loadHistory({ before: null, appendOlder: false })}
            style={styles.headerAction}
            scaleTo={0.9}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="refresh-cw" size={17} color={tc("#24384e", 'fg')} />
          </PressableScale>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={tc("#24384e", 'fg')} />
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
                <Feather name="alert-circle" size={13} color={tc("#a8544c", 'fg')} />
                <Text style={styles.errorBannerText}>{historyError}</Text>
              </View>
            ) : null}

            {socketError ? (
              <View style={[styles.errorBanner, styles.warnBanner]}>
                <Feather name="wifi-off" size={13} color={tc("#9a6a14", 'fg')} />
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
                  <ActivityIndicator size="small" color={tc("#5b6a7a", 'fg')} />
                ) : (
                  <Text style={styles.loadOlderText}>Mesaje anterioare</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <FlatList
              ref={listRef}
              data={listItems}
              keyExtractor={(item) => item.key}
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
                    <Feather name="message-circle" size={22} color={tc("#8a97a5", 'fg')} />
                  </View>
                  <Text style={styles.emptyText}>Liniște deocamdată.{'\n'}Scrie primul mesaj.</Text>
                </View>
              }
            />

            {showScrollDown ? (
              <PressableScale accessibilityRole="button" accessibilityLabel="Mergi la ultimele mesaje"
                style={styles.scrollDownBtn}
                scaleTo={0.9}
                onPress={() => {
                  listRef.current?.scrollToEnd({ animated: true });
                  isNearBottomRef.current = true;
                  shouldAutoScrollRef.current = true;
                  setShowScrollDown(false);
                  getToken().then((token) => {
                    if (token) api.markChatAsRead(token).then(syncAppBadge).catch(() => {});
                  });
                }}
              >
                <Feather name="chevron-down" size={18} color={tc("#fff", 'fg')} />
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
                  placeholderTextColor={tc("#8a97a5", 'fg')}
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
                {remainingChars < 200 ? (
                  <Text style={styles.counterText}>{Math.max(0, remainingChars)}</Text>
                ) : null}
                <PressableScale accessibilityRole="button" accessibilityLabel="Trimite mesajul"
                  style={[styles.sendBtn, !String(draft || '').trim().length && styles.sendBtnIdle]}
                  onPress={handleSend}
                  scaleTo={0.88}
                >
                  <Feather name="arrow-up" size={18} color={tc("#fff", 'fg')} />
                </PressableScale>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.28)', 'bg'),
    marginRight: 12,
    zIndex: 10,
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.2,
    fontSize: 21,
    fontWeight: '700',
    color: tc('#1c2b3a', 'fg'),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusDotOnline: { backgroundColor: tc('#3d7d5f', 'bg') },
  statusDotOffline: { backgroundColor: tc('#9aa5b1', 'bg') },
  statusText: { color: tc('#5b6a7a', 'fg'), fontSize: 11.5, fontWeight: '500' },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.28)', 'bg'),
  },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 8, color: tc('#5b6a7a', 'fg') },

  chatContainer: { flex: 1 },

  // Bannere
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(168,84,76,0.35)', 'bg'),
    backgroundColor: tc('rgba(168,84,76,0.07)', 'bg'),
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorBannerText: { color: tc('#a8544c', 'fg'), fontSize: 12, flex: 1 },
  warnBanner: {
    borderColor: tc('rgba(179,146,79,0.4)', 'bg'),
    backgroundColor: tc('rgba(179,146,79,0.07)', 'bg'),
  },
  warnBannerText: { color: tc('#9a6a14', 'fg') },

  loadOlderBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.25)', 'bg'),
    backgroundColor: tc('rgba(255,255,255,0.45)', 'bg'),
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 10,
  },
  loadOlderBtnDisabled: { opacity: 0.7 },
  loadOlderText: {
    color: tc('#5b6a7a', 'fg'),
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
    backgroundColor: tc('rgba(255,255,255,0.5)', 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.24)', 'bg'),
    marginBottom: 12,
  },
  emptyText: { textAlign: 'center', color: tc('#8a97a5', 'fg'), fontSize: 13, lineHeight: 20 },

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
    backgroundColor: tc('rgba(32,47,62,0.22)', 'bg'),
    minWidth: 18,
  },
  systemText: {
    color: tc('#8a97a5', 'fg'),
    fontSize: 11,
    textAlign: 'center',
    flexShrink: 1,
  },

  // Separator de zi
  dayRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  dayText: {
    color: tc('#5b6a7a', 'fg'),
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    overflow: 'hidden',
    backgroundColor: tc('rgba(255,255,255,0.62)', 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // Grupare: mesajele consecutive ale aceleiași persoane stau mai aproape
  groupInner: { marginBottom: 3 },
  groupEnd: { marginBottom: 12 },

  // Mesajele mele
  mineRow: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    alignItems: 'flex-end',
  },
  mineBubble: {
    backgroundColor: tc('rgba(28,43,58,0.92)', 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mineBubbleTail: { borderBottomRightRadius: 6 },
  mineBubbleSending: { opacity: 0.6 },
  mineBubbleFailed: {
    backgroundColor: tc('rgba(168,84,76,0.9)', 'bg'),
  },
  mineText: { color: tc('#f6f7f8', 'fg'), fontSize: 14.5, lineHeight: 20 },
  mineTime: { color: tc('#9aa5b1', 'fg'), fontSize: 10, marginTop: 4, marginRight: 4 },
  mineStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginRight: 4 },
  mineStatusText: { color: tc('#9aa5b1', 'fg'), fontSize: 10 },
  failedText: { color: tc('#a8544c', 'fg'), fontSize: 10.5, fontWeight: '600' },

  // Mesajele altora
  otherRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '86%',
  },
  otherAvatarSpacer: { width: 36 },
  otherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.3)', 'bg'),
  },
  otherAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tc('rgba(255,255,255,0.6)', 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.3)', 'bg'),
  },
  otherAvatarInitial: { fontSize: 11, color: tc('#24384e', 'fg'), fontWeight: '700' },
  otherContent: { flexShrink: 1 },
  otherName: {
    color: tc('#8a97a5', 'fg'),
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    marginLeft: 4,
  },
  otherTime: { color: tc('#b6bfc9', 'fg'), fontWeight: '400', fontSize: 10 },
  otherBubbleTail: { borderTopLeftRadius: 6 },
  otherBubble: {
    backgroundColor: tc('rgba(255,255,255,0.62)', 'bg'),
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.24)', 'bg'),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  otherText: { color: tc('#1c2b3a', 'fg'), fontSize: 14.5, lineHeight: 20 },

  // Composer
  composerWrap: {
    marginTop: 6,
    paddingTop: 4,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: tc('rgba(255,255,255,0.6)', 'bg'),
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc('rgba(32,47,62,0.3)', 'bg'),
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    color: tc('#1c2b3a', 'fg'),
    fontSize: 14.5,
    textAlignVertical: 'center',
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: 6,
  },
  counterText: {
    alignSelf: 'center',
    color: tc('#8a97a5', 'fg'),
    fontSize: 10,
    marginHorizontal: 6,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc('rgba(28,43,58,0.92)', 'bg'),
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
    backgroundColor: tc('rgba(28,43,58,0.92)', 'bg'),
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

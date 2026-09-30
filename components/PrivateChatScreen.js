import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppHeader, PressableScale } from './ui';
import { colors } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';
import { mergePrivateMessages } from '../utils/privateMessages.mjs';

export default function PrivateChatScreen({ route, navigation }) {
  const { userId, name = 'Prieten' } = route.params;
  const { tc } = useTheme(), styles = useThemedStyles(createStyles);
  const [messages,setMessages] = useState([]), [text,setText] = useState(''), [error,setError] = useState(''), [revoked,setRevoked] = useState(false), [loading,setLoading] = useState(true), [sending,setSending] = useState(false), [hasOlder,setHasOlder] = useState(false), [olderLoading,setOlderLoading] = useState(false);
  const owner = useRef(null), newest = useRef(0), token = useRef(null), live = useRef(false), refreshing = useRef(false), olderCursor = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const receive = useCallback(async (initial = false) => {
    if (refreshing.current || AppState.currentState !== 'active') return;
    refreshing.current = true;
    try {
      token.current = await getToken(); owner.current = (await getUser())?.id;
      let more;
      do {
        const data = await api.getPrivateMessages(userId,token.current,newest.current && !initial ? 'after' : null,newest.current && !initial ? newest.current : null);
        if (!live.current || AppState.currentState !== 'active') return;
        setMessages((old) => mergePrivateMessages(old,data.items));
        if (initial) { setHasOlder(data.hasMore); olderCursor.current = data.items[0]?.id; }
        if (data.items.length) newest.current = Math.max(newest.current,...data.items.map((item) => Number(item.id)));
        more = !initial && data.hasMore; initial = false;
      } while (more && live.current);
      if (newest.current && live.current && AppState.currentState === 'active') await api.readPrivateMessages(userId,newest.current,token.current);
      if (live.current) { setError(''); setRevoked(false); }
    } catch (e) { if (live.current) { setError(e.message); if ([401,403,404].includes(e.status)) setRevoked(true); } }
    finally { refreshing.current = false; if (live.current) setLoading(false); }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    live.current = true; receive(!newest.current);
    const interval = setInterval(() => receive(),5000);
    const foreground = AppState.addEventListener('change',(state) => state === 'active' && receive());
    return () => { live.current = false; clearInterval(interval); foreground.remove(); };
  }, [receive]));
  const older = async () => {
    if (olderLoading || !olderCursor.current) return; setOlderLoading(true);
    try { const data = await api.getPrivateMessages(userId,token.current,'before',olderCursor.current); if (!live.current) return; setMessages((old) => mergePrivateMessages(old,data.items)); setHasOlder(data.hasMore); olderCursor.current = data.items[0]?.id; }
    catch (e) { setError(e.message); } finally { setOlderLoading(false); }
  };
  const send = async (retry) => {
    if (sending || revoked) return;
    const content = retry?.content || text.trim(); if (!content || !owner.current || !token.current) return;
    const item = retry || { clientId: Crypto.randomUUID(), senderId: owner.current, recipientId: userId, content, createdAt: new Date().toISOString() };
    setSending(true); setError(''); if (!retry) setText('');
    setMessages((old) => mergePrivateMessages(old,[{ ...item, failed: false, pending: true }]));
    try { const data = await api.sendPrivateMessage(userId,{ clientId: item.clientId, content: item.content },token.current); if (mounted.current && String((await getUser())?.id) === String(item.senderId)) setMessages((old) => mergePrivateMessages(old,[data.item])); }
    catch (e) { if (mounted.current && String((await getUser())?.id) === String(item.senderId)) { setMessages((old) => mergePrivateMessages(old,[{ ...item, failed: true, pending: false }])); setError(e.message); if ([401,403,404].includes(e.status)) setRevoked(true); } }
    finally { if (mounted.current) setSending(false); }
  };
  return <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><AppHeader title={name} subtitle="Conversație privată" onBack={() => navigation.goBack()} rightAction={<PressableScale onPress={() => navigation.navigate('PublicProfile',{ userId })} style={styles.profileButton} accessibilityRole="button" accessibilityLabel="Vezi profilul prietenului"><Feather name="user" size={23} color={tc(colors.primary,'fg')} /></PressableScale>} /></View>
    {error ? <View style={styles.errorBox}><Text style={styles.error} accessibilityRole="alert">{error}</Text><AppButton title="Reîncearcă conectarea" variant="ghost" onPress={() => receive()} /></View> : null}
    {loading ? <ActivityIndicator color={tc(colors.primary,'fg')} /> : null}
    <FlatList style={styles.fill} inverted data={messages} keyExtractor={(item) => `${item.senderId}:${item.clientId}`} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListEmptyComponent={!loading ? <Text style={styles.empty}>Primul mesaj poate fi un simplu „Salut”.</Text> : null} ListFooterComponent={hasOlder ? <AppButton title="Mesaje anterioare" variant="ghost" loading={olderLoading} onPress={older} /> : null} renderItem={({ item }) => {
      const mine = String(item.senderId) === String(owner.current);
      return <View style={[styles.message,mine ? styles.mine : styles.theirs]}><Text style={styles.messageText}>{item.content}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleString('ro-RO',{ day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' })}{item.pending ? ' · Se trimite…' : item.failed ? ' · Netrimis' : ''}</Text>{item.failed ? <AppButton title="Retrimite mesajul" variant="ghost" disabled={sending || revoked} onPress={() => send(item)} /> : null}</View>;
    }} />
    <View style={styles.composer}><TextInput accessibilityLabel="Mesaj privat" style={styles.input} value={text} onChangeText={setText} placeholder={revoked ? 'Chat indisponibil' : 'Scrie un mesaj…'} placeholderTextColor={tc(colors.textMuted,'fg')} multiline maxLength={2000} editable={!revoked && !loading} /><PressableScale onPress={() => send()} disabled={sending || revoked || !text.trim() || loading} style={[styles.send,(!text.trim() || revoked || sending || loading) && styles.disabled]} accessibilityRole="button" accessibilityLabel="Trimite mesaj privat"><Feather name="send" size={21} color={tc(colors.white,'fg')} /></PressableScale></View>
    <Text style={styles.counter}>{text.length}/2000</Text>
  </KeyboardAvoidingView></SafeAreaView>;
}
const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc(colors.background,'bg'), ...(Platform.OS === 'web' ? StyleSheet.absoluteFillObject : {}) }, fill: { flex: 1 }, header: { paddingHorizontal: 18, paddingTop: 10 },
  profileButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, list: { padding: 18 },
  message: { maxWidth: '87%', padding: 14, borderRadius: 18, marginVertical: 5 }, mine: { alignSelf: 'flex-end', backgroundColor: tc(colors.primarySoft,'bg') }, theirs: { alignSelf: 'flex-start', backgroundColor: tc(colors.surfaceStrong,'bg') },
  messageText: { fontSize: 15, lineHeight: 23, color: tc(colors.text,'fg') }, time: { fontSize: 10, lineHeight: 16, marginTop: 6, color: tc(colors.textMuted,'fg') },
  empty: { fontSize: 14, lineHeight: 22, color: tc(colors.textMuted,'fg'), paddingVertical: 24 }, errorBox: { paddingHorizontal: 18 }, error: { fontSize: 13, lineHeight: 20, color: tc(colors.danger,'fg') },
  composer: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc(colors.border,'bg') },
  input: { flex: 1, minHeight: 48, maxHeight: 130, padding: 12, borderRadius: 16, backgroundColor: tc(colors.surfaceStrong,'bg'), color: tc(colors.text,'fg'), fontSize: 15, lineHeight: 22 },
  send: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: tc(colors.primary,'bg') }, disabled: { opacity: 0.4 }, counter: { textAlign: 'right', paddingHorizontal: 78, paddingVertical: 5, fontSize: 10, color: tc(colors.textMuted,'fg') },
});

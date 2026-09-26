import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, Keyboard, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { hapticNotify } from '../utils/haptics';

const SHARED_PUSH_TOKEN_KEY = 'quote_push_token';

export default function IntrebariScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [myQuestions, setMyQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const enableQuestionReplyNotifications = async (authToken) => {
    if (!authToken) return;

    try {
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

      if (expoPushToken) {
        await api.registerPushToken({ token: expoPushToken, platform: Platform.OS, enabled: true }, authToken);
      }
    } catch (error) {
      console.warn('Question notifications setup failed:', error?.message || error);
    }
  };

  const loadMyQuestions = async (showLoader = true) => {
    const token = await getToken();
    if (!token) {
      setMyQuestions([]);
      return;
    }
    if (showLoader) setLoadingQuestions(true);
    try {
      const result = await api.listMyQuestions(token);
      setMyQuestions(Array.isArray(result?.items) ? result.items : []);
    } catch {
      // Keep the form usable even if history loading fails.
    } finally {
      if (showLoader) setLoadingQuestions(false);
    }
  };

  React.useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([getUser(), getToken()]);
      if (t) {
        setIsLoggedIn(true);
        await loadMyQuestions(true);
      }
      if (u?.name) setName(u.name);
      if (u?.email) setEmail(u.email);
    })();
  }, []);

  const sendQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Mesaj gol', 'Te rog scrie întrebarea ta.');
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const payload = { question, consent };
      // Always include name/email if available (from stored login or manual input)
      if (name) payload.name = name;
      if (email) payload.email = email;
      await api.createQuestion(payload, token || undefined);
      if (token) {
        await enableQuestionReplyNotifications(token);
      }
      hapticNotify('success');
      Alert.alert('Întrebare trimisă', 'Îți mulțumesc pentru întrebare. Eu, Dan, îți voi răspunde în cel mult 24 ore.');
      setQuestion('');
      setConsent(true);
      if (!token) {
        // Anonymous submit: clear manually-entered identity
        setName('');
        setEmail('');
      } else {
        await loadMyQuestions(false);
        // Logged-in: keep identity; refresh from storage in case state was changed
        const u = await getUser();
        if (u?.name) setName(u.name);
        if (u?.email) setEmail(u.email);
      }
    } catch (e) {
      Alert.alert('Eroare', e?.message || 'Nu am putut trimite întrebarea. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>Trimite-mi o întrebare</Text>
              <Text style={styles.subtitle}>Scrie mai jos ce te preocupă</Text>
            </View>
          </View>

          <View style={styles.card}>
            {isLoggedIn ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.inputLabel}>
                  Se trimite ca: <Text style={{ color: tc('#1c2b3a', 'fg'), fontWeight: '600' }}>{name || 'Utilizator'}</Text>{email ? ` (${email})` : ''}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Câteva detalii (opțional)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Nume</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Numele tău"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@exemplu.com"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            <Text style={[styles.cardTitle, { marginTop: 10 }]}>Întrebarea ta</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Ex: Cum pot gestiona mai bine anxietatea socială?"
              placeholderTextColor={tc("#8a97a5", 'fg')}
              style={styles.textarea}
              multiline
            />
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.consentText}>Sunt de acord ca întrebarea mea să fie folosită în materiale educaționale (fără date personale).</Text>
              </View>
              <Switch value={consent} onValueChange={setConsent} />
            </View>
            <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={sendQuestion} disabled={loading}>
              <LinearGradient colors={[tc("rgba(28,43,58,0.94)", 'bg'), tc("rgba(22,34,47,0.96)", 'bg')]} style={styles.btnInner}>
                {loading ? <ActivityIndicator color={tc("#fff", 'fg')} /> : <Text style={styles.primaryText}>Trimite</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {isLoggedIn && (
            <View style={styles.card}>
              <View style={styles.historyHeader}>
                <Text style={styles.cardTitle}>Întrebările tale</Text>
                <TouchableOpacity onPress={() => loadMyQuestions(true)}>
                  <Text style={styles.historyRefresh}>Reîncarcă</Text>
                </TouchableOpacity>
              </View>

              {loadingQuestions ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color={tc("#24384e", 'fg')} />
                </View>
              ) : myQuestions.length === 0 ? (
                <Text style={styles.historyEmpty}>Nu ai întrebări trimise încă.</Text>
              ) : (
                myQuestions.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyDate}>{fmtDate(item.created_at)}</Text>
                      <View style={[styles.statusBadge, styles[`statusBadge_${item.status || 'new'}`]]}>
                        <Text style={styles.statusBadgeText}>{statusLabel(item.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyQuestion}>{item.question}</Text>

                    {item.admin_response ? (
                      <View style={styles.answerBox}>
                        <Text style={styles.answerTitle}>Răspuns de la Dan</Text>
                        <Text style={styles.answerText}>{item.admin_response}</Text>
                        {item.responded_at ? <Text style={styles.answerDate}>{fmtDate(item.responded_at)}</Text> : null}
                      </View>
                    ) : (
                      <Text style={styles.pendingAnswer}>Așteaptă răspunsul lui Dan.</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function statusLabel(status) {
  return {
    new: 'Nouă',
    read: 'Citită',
    answered: 'Răspunsă',
    archived: 'Arhivată',
  }[status] || 'Nouă';
}

function fmtDate(value) {
  if (!value) return '–';
  return new Date(value).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 20, fontWeight: '700', color: tc('#1c2b3a', 'fg') },
  subtitle: { fontSize: 13, color: tc('#5b6a7a', 'fg'), marginTop: 2 },
  card: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginBottom: 6 },
  inputLabel: { fontSize: 12, color: tc('#8a97a5', 'fg'), marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: tc('rgba(255,255,255,0.68)', 'bg'), color: tc('#1c2b3a', 'fg'),
  },
  textarea: {
    minHeight: 120, borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'), borderRadius: 12, padding: 10,
    textAlignVertical: 'top', backgroundColor: tc('rgba(255,255,255,0.68)', 'bg'), color: tc('#1c2b3a', 'fg'),
  },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: tc('#fff', 'fg'), fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  consentText: { fontSize: 12, color: tc('#5b6a7a', 'fg') },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  historyRefresh: { color: tc('#24384e', 'fg'), fontWeight: '600', fontSize: 13 },
  historyEmpty: { fontSize: 13, color: tc('#5b6a7a', 'fg'), marginTop: 4 },
  historyItem: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.22)', 'bg'),
    borderRadius: 12,
    backgroundColor: tc('rgba(255,255,255,0.65)', 'bg'),
    padding: 12,
  },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate: { fontSize: 11, color: tc('#8a97a5', 'fg') },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusBadge_new: { backgroundColor: tc('rgba(36,56,78,0.14)', 'bg') },
  statusBadge_read: { backgroundColor: tc('rgba(92,90,128,0.16)', 'bg') },
  statusBadge_answered: { backgroundColor: tc('rgba(61,125,95,0.16)', 'bg') },
  statusBadge_archived: { backgroundColor: tc('rgba(107,118,131,0.16)', 'bg') },
  statusBadgeText: { fontSize: 11, color: tc('#1c2b3a', 'fg'), fontWeight: '600' },
  historyQuestion: { marginTop: 8, fontSize: 14, color: tc('#1c2b3a', 'fg'), lineHeight: 21 },
  answerBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tc('rgba(61,125,95,0.28)', 'bg'),
    backgroundColor: tc('rgba(61,125,95,0.08)', 'bg'),
    padding: 10,
  },
  answerTitle: { fontSize: 12, color: tc('#0f8f56', 'fg'), fontWeight: '700', marginBottom: 4 },
  answerText: { fontSize: 13, color: tc('#1c2b3a', 'fg'), lineHeight: 20 },
  answerDate: { marginTop: 6, fontSize: 11, color: tc('#5b6a7a', 'fg') },
  pendingAnswer: { marginTop: 10, fontSize: 12, color: tc('#5b6a7a', 'fg') },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, Keyboard, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';

const SHARED_PUSH_TOKEN_KEY = 'quote_push_token';

export default function IntrebariScreen({ navigation }) {
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
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
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
                  Se trimite ca: <Text style={{ color: '#1c2b3a', fontWeight: '600' }}>{name || 'Utilizator'}</Text>{email ? ` (${email})` : ''}
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
                      placeholderTextColor="#8a97a5"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@exemplu.com"
                      placeholderTextColor="#8a97a5"
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
              placeholderTextColor="#8a97a5"
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
              <LinearGradient colors={["#24384e", "#16222f"]} style={styles.btnInner}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Trimite</Text>}
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
                  <ActivityIndicator color="#24384e" />
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 20, fontWeight: '700', color: '#1c2b3a' },
  subtitle: { fontSize: 13, color: '#5b6a7a', marginTop: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c2b3a', marginBottom: 6 },
  inputLabel: { fontSize: 12, color: '#8a97a5', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.94)', color: '#1c2b3a',
  },
  textarea: {
    minHeight: 120, borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)', borderRadius: 12, padding: 10,
    textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.94)', color: '#1c2b3a',
  },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  consentText: { fontSize: 12, color: '#5b6a7a' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  historyRefresh: { color: '#24384e', fontWeight: '600', fontSize: 13 },
  historyEmpty: { fontSize: 13, color: '#5b6a7a', marginTop: 4 },
  historyItem: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.22)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 12,
  },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate: { fontSize: 11, color: '#8a97a5' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusBadge_new: { backgroundColor: 'rgba(36,56,78,0.14)' },
  statusBadge_read: { backgroundColor: 'rgba(92,90,128,0.16)' },
  statusBadge_answered: { backgroundColor: 'rgba(61,125,95,0.16)' },
  statusBadge_archived: { backgroundColor: 'rgba(107,118,131,0.16)' },
  statusBadgeText: { fontSize: 11, color: '#1c2b3a', fontWeight: '600' },
  historyQuestion: { marginTop: 8, fontSize: 14, color: '#1c2b3a', lineHeight: 21 },
  answerBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(61,125,95,0.28)',
    backgroundColor: 'rgba(61,125,95,0.08)',
    padding: 10,
  },
  answerTitle: { fontSize: 12, color: '#0f8f56', fontWeight: '700', marginBottom: 4 },
  answerText: { fontSize: 13, color: '#1c2b3a', lineHeight: 20 },
  answerDate: { marginTop: 6, fontSize: 11, color: '#5b6a7a' },
  pendingAnswer: { marginTop: 10, fontSize: 12, color: '#5b6a7a' },
});

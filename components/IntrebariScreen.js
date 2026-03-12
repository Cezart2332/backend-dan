import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser } from '../utils/userStorage';

export default function IntrebariScreen({ navigation }) {
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  React.useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([getUser(), getToken()]);
      if (t) setIsLoggedIn(true);
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
      Alert.alert('Întrebare trimisă', 'Îți mulțumesc! Voi reveni în curând.');
      setQuestion('');
      setConsent(true);
      if (!token) {
        // Anonymous submit: clear manually-entered identity
        setName('');
        setEmail('');
      } else {
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
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
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
                  Se trimite ca: <Text style={{ color: '#2c3e50', fontWeight: '600' }}>{name || 'Utilizator'}</Text>{email ? ` (${email})` : ''}
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
                      placeholderTextColor="#99a6ae"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@exemplu.com"
                      placeholderTextColor="#99a6ae"
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
              placeholderTextColor="#99a6ae"
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
              <LinearGradient colors={["#4a90e2", "#2e6bb8"]} style={styles.btnInner}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Trimite</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(74,144,226,0.15)',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a2d45' },
  subtitle: { fontSize: 13, color: '#6c8096', marginTop: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(200,220,240,0.6)',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a2d45', marginBottom: 6 },
  inputLabel: { fontSize: 12, color: '#8ca8c4', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: 'rgba(200,220,240,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.9)', color: '#1a2d45',
  },
  textarea: {
    minHeight: 120, borderWidth: 1, borderColor: 'rgba(200,220,240,0.6)', borderRadius: 12, padding: 10,
    textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.9)', color: '#1a2d45',
  },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  consentText: { fontSize: 12, color: '#6c8096' },
});

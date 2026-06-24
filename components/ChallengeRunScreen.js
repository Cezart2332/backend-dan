import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { saveChallengeRun } from '../utils/challengeStorage';

export default function ChallengeRunScreen({ route, navigation }) {
  const { level, challenge } = route.params || {};
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [difficulty, setDifficulty] = useState(null);
  const [notes, setNotes] = useState('');

  const diffScale = [1,2,3,4,5];

  const handleStart = () => setStarted(true);
  const handleFinish = () => setFinished(true);
  const canSubmit = finished && difficulty !== null;

  const handleSubmit = async () => {
    const payload = {
      challenge_id: challenge?.id,
      difficulty,
      notes: notes || undefined,
      date: new Date().toISOString(),
    };
    let id = null;
    try {
      const token = await getToken();
      if (token) {
        const res = await api.createChallengeRun(payload, token);
        id = res?.id || null;
      }
    } catch {}
    await saveChallengeRun({ ...payload, id, levelId: level?.id });
    navigation.navigate('Provocari');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>{challenge?.title || 'Provocare'}</Text>
              <Text style={styles.subtitle}>{level?.title ? `Nivel: ${level.title}` : ''}</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {!started && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pregătire</Text>
              <Text style={styles.cardText}>Găsește un loc liniștit. Setează o intenție. Când ești gata, apasă Start.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
                <View style={[styles.btnInner, { backgroundColor: '#2f73d8' }]}>
                  <Text style={styles.primaryText}>Start</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {started && !finished && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>În desfășurare</Text>
              <Text style={styles.cardText}>Urmează pașii provocării. Respiră, observă, notează ce simți.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
                <View style={[styles.btnInner, { backgroundColor: '#3f9f64' }]}>
                  <Text style={styles.primaryText}>Finalizează</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {finished && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Review provocare</Text>
              <Text style={styles.cardText}>Cât de dificil a fost?</Text>
              <View style={styles.scaleWrap}>
                {diffScale.map(n => (
                  <TouchableOpacity key={n} onPress={() => setDifficulty(n)} style={[styles.scaleBtn, difficulty===n && styles.scaleBtnActive]}>
                    <Text style={[styles.scaleText, difficulty===n && styles.scaleTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.cardText, {marginTop: 10}]}>Descrie pe scurt: ce ai observat, ce ai învățat?</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notează aici..."
                placeholderTextColor="#7d93aa"
                style={styles.textarea}
                multiline
              />
              <TouchableOpacity style={[styles.primaryBtn, !canSubmit && {opacity: 0.6}]} disabled={!canSubmit} onPress={handleSubmit}>
                <View style={[styles.btnInner, { backgroundColor: '#2f73d8' }]}>
                  <Text style={styles.primaryText}>Trimite review</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  background: { flex: 1 },
  content: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { flex: 1, alignItems: 'center' },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#18324f', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#58718e', textAlign: 'center', marginTop: 3 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#18324f', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#18324f', lineHeight: 21 },
  primaryBtn: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  btnInner: { paddingVertical: 13, alignItems: 'center', borderRadius: 14 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scaleWrap: { flexDirection: 'row', marginTop: 10 },
  scaleBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  scaleBtnActive: { borderColor: '#2f73d8', backgroundColor: '#f4f9ff' },
  scaleText: { color: '#18324f', fontWeight: '600' },
  scaleTextActive: { color: '#2f73d8' },
  textarea: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: 'rgba(117,154,194,0.18)',
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.94)',
    color: '#18324f',
    fontSize: 14,
  },
});

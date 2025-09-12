import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function ChallengeRunScreen({ route, navigation }) {
  const { level, challenge } = route.params || {};
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [difficulty, setDifficulty] = useState(null); // 1-5
  const [notes, setNotes] = useState('');

  const diffScale = [1,2,3,4,5];

  const handleStart = () => setStarted(true);
  const handleFinish = () => setFinished(true);

  const canSubmit = finished && difficulty !== null;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{challenge?.title || 'Provocare'}</Text>
            <Text style={styles.subtitle}>{level?.title ? `Nivel: ${level.title}` : ''}</Text>
          </View>

          {!started && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pregătire</Text>
              <Text style={styles.cardText}>Găsește un loc liniștit. Setează o intenție. Când ești gata, apasă Start.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
                <LinearGradient colors={["#4a90e2", "#2e6bb8"]} style={styles.btnInner}>
                  <Text style={styles.primaryText}>Start</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {started && !finished && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>În desfășurare</Text>
              <Text style={styles.cardText}>Urmează pașii provocării. Respiră, observă, notează ce simți.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
                <LinearGradient colors={["#5cb85c", "#4cae4c"]} style={styles.btnInner}>
                  <Text style={styles.primaryText}>Finalizează</Text>
                </LinearGradient>
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
              <Text style={[styles.cardText, {marginTop: 8}]}>Descrie pe scurt: ce ai observat, ce ai învățat?</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notează aici..."
                placeholderTextColor="#99a6ae"
                style={styles.textarea}
                multiline
              />
              <TouchableOpacity style={[styles.primaryBtn, !canSubmit && {opacity: 0.6}]} disabled={!canSubmit} onPress={() => navigation.goBack()}>
                <LinearGradient colors={["#4a90e2", "#2e6bb8"]} style={styles.btnInner}>
                  <Text style={styles.primaryText}>Trimite review</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 16 },
  backBtn: {
    position: 'absolute', left: 0, top: -2,
    backgroundColor: '#fff', borderRadius: 20, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e8f4fd', elevation: 3,
  },
  backIcon: { fontSize: 18, color: '#4a90e2', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#2c3e50', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6c7b84', textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#e8f4fd',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 6 },
  cardText: { fontSize: 14, color: '#2c3e50' },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  scaleWrap: { flexDirection: 'row', marginTop: 8 },
  scaleBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#e8f4fd',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    backgroundColor: '#f8fdff',
  },
  scaleBtnActive: { borderColor: '#4a90e2', backgroundColor: '#eaf4ff' },
  scaleText: { color: '#2c3e50', fontWeight: '600' },
  scaleTextActive: { color: '#4a90e2' },
  textarea: {
    marginTop: 8,
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#e8f4fd',
    borderRadius: 12,
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
});

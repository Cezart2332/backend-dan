import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { saveChallengeRun } from '../utils/challengeStorage';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { hapticNotify } from '../utils/haptics';

export default function ChallengeRunScreen({ route, navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
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
    hapticNotify('success');
    navigation.navigate('Provocari');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
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
                <View style={[styles.btnInner, { backgroundColor: tc('#24384e', 'bg') }]}>
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
                <View style={[styles.btnInner, { backgroundColor: tc('#3d7d5f', 'bg') }]}>
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
                placeholderTextColor={tc("#8a97a5", 'fg')}
                style={styles.textarea}
                multiline
              />
              <TouchableOpacity style={[styles.primaryBtn, !canSubmit && {opacity: 0.6}]} disabled={!canSubmit} onPress={handleSubmit}>
                <View style={[styles.btnInner, { backgroundColor: tc('#24384e', 'bg') }]}>
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

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  background: { flex: 1 },
  content: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { flex: 1, alignItems: 'center' },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 20, fontWeight: '700', color: tc('#1c2b3a', 'fg'), textAlign: 'center' },
  subtitle: { fontSize: 13, color: tc('#5b6a7a', 'fg'), textAlign: 'center', marginTop: 3 },
  card: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginBottom: 8 },
  cardText: { fontSize: 14, color: tc('#1c2b3a', 'fg'), lineHeight: 21 },
  primaryBtn: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  btnInner: { paddingVertical: 13, alignItems: 'center', borderRadius: 14 },
  primaryText: { color: tc('#fff', 'fg'), fontWeight: '700', fontSize: 15 },
  scaleWrap: { flexDirection: 'row', marginTop: 10 },
  scaleBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
  },
  scaleBtnActive: { borderColor: tc('#24384e', 'bg'), backgroundColor: tc('#f3f4f6', 'bg') },
  scaleText: { color: tc('#1c2b3a', 'fg'), fontWeight: '600' },
  scaleTextActive: { color: tc('#24384e', 'fg') },
  textarea: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: tc('rgba(255,255,255,0.68)', 'bg'),
    color: tc('#1c2b3a', 'fg'),
    fontSize: 14,
  },
});

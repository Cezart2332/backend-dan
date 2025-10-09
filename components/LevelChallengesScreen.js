import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { levels } from '../challenges';

export default function LevelChallengesScreen({ route, navigation }) {
  const { level } = route.params || {};

  const challenges = useMemo(() => {
    const lvl = levels.find(l => l.id === level?.id);
    return lvl?.challenges || [];
  }, [level]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{level?.title || 'Provocări'}</Text>
            <Text style={styles.subtitle}>{level?.goal || 'Alege o provocare din listă'}</Text>
          </View>

          {challenges.map((ch) => (
            <TouchableOpacity key={ch.id} style={styles.card} onPress={() => navigation.navigate('ChallengeRun', { level, challenge: ch })}>
              <LinearGradient colors={["#ffffff", "#f8fdff"]} style={styles.cardInner}>
                <Text style={styles.cardIcon}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{ch.title}</Text>
                  <Text style={styles.cardMeta}>Durată estimată: {ch.est}</Text>
                </View>
                <Text style={styles.cardArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
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
  title: { fontSize: 22, fontWeight: '700', color: '#2c3e50', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c7b84', textAlign: 'center', marginTop: 6 },
  card: {
    marginTop: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e8f4fd',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardInner: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  cardMeta: { fontSize: 12, color: '#6c7b84', marginTop: 2 },
  cardArrow: { fontSize: 18, color: '#4a90e2', fontWeight: '700' },
});

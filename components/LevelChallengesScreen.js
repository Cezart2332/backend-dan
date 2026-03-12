import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { levels } from '../challenges';

export default function LevelChallengesScreen({ route, navigation }) {
  const { level } = route.params || {};

  const challenges = useMemo(() => {
    const lvl = levels.find(l => l.id === level?.id);
    return lvl?.challenges || [];
  }, [level]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.title}>{level?.title || 'Provocări'}</Text>
            <Text style={styles.subtitle}>{level?.goal || 'Alege o provocare din listă'}</Text>
          </View>

          {challenges.map((ch) => (
            <TouchableOpacity key={ch.id} style={styles.card} onPress={() => navigation.navigate('ChallengeRun', { level, challenge: ch })}>
              <View style={styles.cardInner}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="flash-outline" size={22} color="#4a90e2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{ch.title}</Text>
                  <Text style={styles.cardMeta}>Durată estimată: {ch.est}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  background: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 20, paddingTop: 4 },
  backBtn: {
    position: 'absolute', left: 0, top: 0,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1, borderColor: 'rgba(74,144,226,0.15)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a2d45', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c8096', textAlign: 'center', marginTop: 6 },
  card: {
    marginTop: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1, borderColor: 'rgba(200,220,240,0.6)',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardInner: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(74,144,226,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a2d45' },
  cardMeta: { fontSize: 12, color: '#6c8096', marginTop: 2 },
});

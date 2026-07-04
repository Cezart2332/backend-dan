import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { levels } from '../challenges';

export default function LevelChallengesScreen({ route, navigation }) {
  const { level } = route.params || {};

  const challenges = useMemo(() => {
    // CMS levels come with challenges already attached via route.params
    if (level?.challenges) return level.challenges;
    // Fallback for hardcoded levels
    const lvl = levels.find((l) => l.id === level?.id);
    return lvl?.challenges || [];
  }, [level]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.title}>{level?.title || 'Provocări'}</Text>
            <Text style={styles.subtitle}>{level?.goal || 'Alege o provocare din listă'}</Text>
          </View>

          {challenges.map((ch) => (
            <TouchableOpacity key={ch.id} style={styles.card} onPress={() => navigation.navigate('ChallengeRun', { level, challenge: ch })}>
              <View style={styles.cardInner}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="flash-outline" size={22} color="#24384e" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{ch.title}</Text>
                  <Text style={styles.cardMeta}>Durată estimată: {ch.est}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9aa5b1" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  background: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 20, paddingTop: 4 },
  backBtn: {
    position: 'absolute', left: 0, top: 0, zIndex: 10,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 22, fontWeight: '700', color: '#1c2b3a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5b6a7a', textAlign: 'center', marginTop: 6 },
  card: {
    marginTop: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardInner: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(36,56,78,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1c2b3a' },
  cardMeta: { fontSize: 12, color: '#5b6a7a', marginTop: 2 },
});

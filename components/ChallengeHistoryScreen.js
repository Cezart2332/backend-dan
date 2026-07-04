import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getRuns, replaceAllRuns } from '../utils/challengeStorage';
import { resolveChallengeTitle } from '../challenges';

export default function ChallengeHistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [cmsData, setCmsData] = useState(null);

  const load = async () => {
    try {
      const token = await getToken();
      if (token) {
        const [historyRes, cmsRes] = await Promise.all([
          api.listChallengeRuns(token),
          api.getCmsChallenges().catch(() => ({ levels: [] })),
        ]);
        setCmsData(cmsRes);
        const items = historyRes?.items || [];
        await replaceAllRuns(items);
        setItems(items);
        return;
      }
    } catch {}
    const local = await getRuns();
    setItems(local);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.title}>Istoric provocări</Text>
            <Text style={styles.subtitle}>Ultimele tale încercări</Text>
          </View>

          {items.length === 0 && (
            <View style={styles.emptyCard}>
              <Feather name="award" size={36} color="#9aa5b1" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>Nicio provocare completată încă.</Text>
            </View>
          )}

          {items.map((it) => {
            const resolved = resolveChallengeTitle(it.challenge_id, cmsData);
            const title = resolved.title;
            const date = it.client_date || it.created_at;
            return (
              <TouchableOpacity key={String(it.id)} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { id: it.id })}>
                <View style={styles.cardInner}>
                  <View style={styles.cardIconWrap}>
                    <Feather name="flag" size={20} color="#24384e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardMeta}>{new Date(date).toLocaleString()} · Dificultate: {it.difficulty ?? '-'}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9aa5b1" />
                </View>
              </TouchableOpacity>
            );
          })}
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
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 22, fontWeight: '700', color: '#1c2b3a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5b6a7a', textAlign: 'center', marginTop: 6 },
  emptyCard: {
    alignItems: 'center', padding: 32,
    backgroundColor: 'rgba(255,255,255,0.58)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)', marginTop: 20,
  },
  emptyText: { fontSize: 14, color: '#5b6a7a' },
  card: {
    marginTop: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.58)',
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

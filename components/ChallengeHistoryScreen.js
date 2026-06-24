import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <Text style={styles.title}>Istoric provocări</Text>
            <Text style={styles.subtitle}>Ultimele tale încercări</Text>
          </View>

          {items.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={36} color="#94a9bf" style={{ marginBottom: 10 }} />
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
                    <Ionicons name="flag-outline" size={20} color="#2f73d8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardMeta}>{new Date(date).toLocaleString()} · Dificultate: {it.difficulty ?? '-'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
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
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  background: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 20, paddingTop: 4 },
  backBtn: {
    position: 'absolute', left: 0, top: 0,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#18324f', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#58718e', textAlign: 'center', marginTop: 6 },
  emptyCard: {
    alignItems: 'center', padding: 32,
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)', marginTop: 20,
  },
  emptyText: { fontSize: 14, color: '#58718e' },
  card: {
    marginTop: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardInner: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(47,115,216,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#18324f' },
  cardMeta: { fontSize: 12, color: '#58718e', marginTop: 2 },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getRunById } from '../utils/challengeStorage';
import { resolveChallengeTitle } from '../challenges';

export default function ChallengeDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [item, setItem] = useState(null);

  const [cmsData, setCmsData] = useState(null);

  const load = async () => {
    const [token, cmsRes] = await Promise.all([
      getToken(),
      api.getCmsChallenges().catch(() => ({ levels: [] })),
    ]);
    setCmsData(cmsRes);
    if (token) {
      try {
        const res = await api.getChallengeRun(id, token);
        if (res) return setItem(res);
      } catch {}
    }
    const local = await getRunById(id);
    setItem(local);
  };

  useEffect(() => { load(); }, [id]);

  const resolved = item ? resolveChallengeTitle(item.challenge_id, cmsData) : { title: 'Detalii provocare', levelTitle: '' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.title}>{resolved.title}</Text>
            <Text style={styles.subtitle}>{resolved.levelTitle}</Text>
          </View>

          {item ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rezumat</Text>
              <Text style={styles.cardText}>Data: {new Date(item.client_date || item.created_at).toLocaleString()}</Text>
              <Text style={styles.cardText}>Dificultate: {item.difficulty ?? '-'}</Text>
              {!!item.notes && <Text style={[styles.cardText, { marginTop: 8 }]}>Note: {item.notes}</Text>}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#5b6a7a' }}>Se încarcă...</Text>
          )}
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
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 20, fontWeight: '700', color: '#1c2b3a', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#5b6a7a', textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.58)', borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c2b3a', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#1c2b3a', lineHeight: 22 },
});

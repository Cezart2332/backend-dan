import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getRunById } from '../utils/challengeStorage';
import { getChallengeById } from '../challenges';

export default function ChallengeDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [item, setItem] = useState(null);

  const load = async () => {
    const token = await getToken();
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

  const resolved = item ? getChallengeById(item.challenge_id) : null;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#f0f8ff", "#e6f3ff", "#ffffff"]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{resolved?.challenge?.title || 'Detalii provocare'}</Text>
            <Text style={styles.subtitle}>{resolved?.level?.title || ''}</Text>
          </View>

          {item ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rezumat</Text>
              <Text style={styles.cardText}>Data: {new Date(item.client_date || item.created_at).toLocaleString()}</Text>
              <Text style={styles.cardText}>Dificultate: {item.difficulty ?? '-'}</Text>
              {!!item.notes && <Text style={[styles.cardText, { marginTop: 8 }]}>Note: {item.notes}</Text>}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#6c7b84' }}>Se încarcă...</Text>
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
});

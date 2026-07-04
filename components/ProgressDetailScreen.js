import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getEntryById, isBackendReady } from '../utils/progressStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';

export default function ProgressDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    (async () => {
      let data = null;
      const backendReady = await isBackendReady();
      try {
        const token = await getToken();
        if (token) {
          const row = await api.getProgress(id, token);
          data = {
            id: String(row.id),
            date: row.client_date || row.created_at,
            level: row.level,
            description: row.description,
            actions: row.actions,
          };
        }
      } catch {}
      if (!data && !backendReady) data = await getEntryById(id);
      setEntry(data);
    })();
  }, [id]);

  if (!entry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.title}>Detaliu Progres</Text>
          </View>
          <View style={styles.loadingWrap}><Text style={styles.loading}>Se încarcă...</Text></View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const dateObj = new Date(entry.date);
  const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={22} color="#24384e" />
          </TouchableOpacity>
          <Text style={styles.title}>Detaliu Progres</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>Data</Text>
            <Text style={styles.value}>{dateStr}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Nivel anxietate</Text>
            <Text style={styles.value}>{entry.level}/10</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Descriere</Text>
            <Text style={styles.value}>{entry.description || '—'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Acțiuni recente</Text>
            <Text style={styles.value}>{entry.actions || '—'}</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  background: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
    marginRight: 14,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 22, fontWeight: '700', color: '#1c2b3a' },
  content: { padding: 16 },
  card: {
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  label: { color: '#8a97a5', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  value: { color: '#1c2b3a', fontWeight: '600', fontSize: 15 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: '#5b6a7a' },
});

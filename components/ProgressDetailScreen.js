import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
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
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Detaliu Progres</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Data</Text>
            <Text style={styles.value}>{dateStr}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Nivel anxietate</Text>
            <Text style={styles.value}>{entry.level}/10</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Descriere</Text>
            <Text style={styles.value}>{entry.description || '—'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Acțiuni recente</Text>
            <Text style={styles.value}>{entry.actions || '—'}</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: { position: 'relative', alignItems: 'center', paddingVertical: 12 },
  backButton: {
    position: 'absolute', left: 16, top: 8, padding: 8, borderRadius: 20,
    backgroundColor: '#ffffff', elevation: 3, shadowColor: '#4a90e2', shadowOpacity: 0.1, shadowRadius: 4
  },
  backButtonText: { fontSize: 18, color: '#4a90e2', fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: '700', color: '#2c3e50' },
  content: { padding: 16 },
  section: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e8f4fd' },
  label: { color: '#6c7b84', marginBottom: 4 },
  value: { color: '#2c3e50', fontWeight: '600' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: '#6c7b84' }
});

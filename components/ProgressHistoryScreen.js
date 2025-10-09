import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getEntries, replaceAllWithServerEntries, isBackendReady } from '../utils/progressStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';

export default function ProgressHistoryScreen({ navigation }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const backendReady = await isBackendReady();
      try {
        const token = await getToken();
        if (token) {
          const res = await api.listProgress(token);
          const serverItems = res?.items || [];
          const mapped = serverItems.map((row) => ({
            id: String(row.id),
            date: row.client_date || row.created_at,
            level: row.level,
            description: row.description,
            actions: row.actions,
          }));
          // Replace local cache with server items (single source of truth)
          await replaceAllWithServerEntries(serverItems);
          setEntries(mapped);
          return;
        }
      } catch {}
      // If backend is not ready or no token, fallback to local cache
      if (!backendReady) {
        const list = await getEntries();
        setEntries(list);
      }
    });
    return unsubscribe;
  }, [navigation]);

  const renderItem = ({ item }) => {
    const dateObj = new Date(item.date);
    const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProgressDetail', { id: item.id })}>
        <View style={styles.row}>
          <Text style={styles.level}>Nivel: {item.level}/10</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{item.description || 'Fără descriere'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Istoric Progres</Text>
        </View>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Nu există intrări încă.</Text>}
        />
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
  list: { padding: 16 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#e8f4fd', shadowColor: '#4a90e2', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  level: { fontWeight: '700', color: '#2c3e50' },
  date: { color: '#6c7b84' },
  desc: { color: '#2c3e50' },
  empty: { textAlign: 'center', color: '#6c7b84', marginTop: 40 }
});

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
          await replaceAllWithServerEntries(serverItems);
          setEntries(mapped);
          return;
        }
      } catch {}
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
        <View style={styles.cardRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="bar-chart-outline" size={18} color="#2f73d8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Text style={styles.level}>Nivel: {item.level}/10</Text>
              <Text style={styles.date}>{dateStr}</Text>
            </View>
            <Text style={styles.desc} numberOfLines={2}>{item.description || 'Fără descriere'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a9bf" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.background}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#2f73d8" />
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
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  background: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
    marginRight: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#18324f' },
  list: { padding: 16 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(47,115,216,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  level: { fontWeight: '700', color: '#18324f', fontSize: 14 },
  date: { color: '#58718e', fontSize: 12 },
  desc: { color: '#58718e', fontSize: 13 },
  empty: { textAlign: 'center', color: '#58718e', marginTop: 40 },
});

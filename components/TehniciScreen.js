import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function TehniciScreen({ navigation }) {
  const items = [
    {
      id: 1,
      title: 'Tehnica HAI - metoda care elimina anxietatea',
      emoji: '🌬️',
    },
    {
      id: 2,
      title: 'Tehnica HAI in Stările fizice din anxietate',
      emoji: '🫀',
    },
    {
      id: 3,
      title: 'Tehnica HAI in Stările psihologice din anxietate',
      emoji: '🧠',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Tehnici pentru imbunatatirea anxietatii</Text>
          {items.map((it) => (
            <TouchableOpacity key={it.id} style={styles.card}>
              <Text style={styles.emoji}>{it.emoji}</Text>
              <Text style={styles.cardText}>{it.title}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Înapoi</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8f4fd',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: { fontSize: 22, marginRight: 10 },
  cardText: { flex: 1, fontSize: 15, color: '#2c3e50', fontWeight: '500' },
  backBtn: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  backText: { color: '#2c3e50', fontWeight: '600' },
});

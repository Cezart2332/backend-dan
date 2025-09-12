import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function IntrebariScreen({ navigation }) {
  const [question, setQuestion] = useState('');

  const sendQuestion = () => {
    if (!question.trim()) {
      Alert.alert('Mesaj gol', 'Te rog scrie întrebarea ta.');
      return;
    }
    Alert.alert('Întrebare trimisă', 'Îți mulțumesc! Voi reveni în curând.');
    setQuestion('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Trimite-mi o întrebare</Text>
            <Text style={styles.subtitle}>Scrie mai jos ce te preocupă</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Întrebarea ta</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Ex: Cum pot gestiona mai bine anxietatea socială?"
              placeholderTextColor="#99a6ae"
              style={styles.textarea}
              multiline
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={sendQuestion}>
              <LinearGradient colors={["#4a90e2", "#2e6bb8"]} style={styles.btnInner}>
                <Text style={styles.primaryText}>Trimite</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  textarea: {
    minHeight: 120, borderWidth: 1, borderColor: '#e8f4fd', borderRadius: 12, padding: 10,
    textAlignVertical: 'top', backgroundColor: '#ffffff',
  },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});

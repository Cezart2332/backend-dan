import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const CALENDLY_URL = 'https://calendly.com/'; // TODO: replace with Dan's actual Calendly link

export default function DirectScreen({ navigation }) {
  const openCalendly = async () => {
    const supported = await Linking.canOpenURL(CALENDLY_URL);
    if (supported) {
      await Linking.openURL(CALENDLY_URL);
    } else {
      Alert.alert('Eroare', 'Nu pot deschide link-ul de programare.');
    }
  };

  const sendJournal = () => {
    // Placeholder action; wire to your journal sending flow
    Alert.alert('Jurnal trimis', 'Jurnalul tău a fost trimis către Dan.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Intră în direct cu Dan</Text>
            <Text style={styles.subtitle}>Programează o sesiune sau trimite jurnalul pentru analiză</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Programează-te</Text>
            <Text style={styles.cardText}>Alege un interval disponibil în calendar.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={openCalendly}>
              <LinearGradient colors={["#4a90e2", "#2e6bb8"]} style={styles.btnInner}>
                <Text style={styles.primaryText}>Programează-te</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trimite jurnalul</Text>
            <Text style={styles.cardText}>Trimite-ți jurnalul către Dan pentru feedback.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={sendJournal}>
              <LinearGradient colors={["#5cb85c", "#4cae4c"]} style={styles.btnInner}>
                <Text style={styles.primaryText}>Trimite jurnal</Text>
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
  cardText: { fontSize: 14, color: '#2c3e50' },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});

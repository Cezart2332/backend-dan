import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

export default function AjutorScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Ai nevoie de ajutor chiar acum?</Text>
            <Text style={styles.subtitle}>Alege ce simți acum și intră în modul de intervenție rapidă.</Text>
          </View>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AjutorAnxietateVideo')}>
            <LinearGradient colors={["#ffffff", "#f3fff3"]} style={styles.cardInner}>
              <Text style={styles.cardIcon}>😌</Text>
              <Text style={[styles.cardTitle, { color: '#2c3e50' }]}>AJUTOR - am anxietate acum</Text>
              <Text style={styles.cardArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AjutorRauVideo')}>
            <LinearGradient colors={["#ffffff", "#f3fff3"]} style={styles.cardInner}>
              <Text style={styles.cardIcon}>😌</Text>
              <Text style={[styles.cardTitle, { color: '#2c3e50' }]}>AJUTOR - imi este rau acum</Text>
              <Text style={styles.cardArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card}>
            <LinearGradient colors={["#ffffff", "#f3fff3"]} style={styles.cardInner}>
              <Text style={styles.cardIcon}>🆘</Text>
              <Text style={[styles.cardTitle, { color: '#2c3e50' }]}>AJUTOR- am atac de panică acum</Text>
              <Text style={styles.cardArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Înapoi</Text>
          </TouchableOpacity>
        </ScrollView>
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  headerWrap: { marginBottom: 8 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c7b84',
    textAlign: 'center',
  },
  card: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8f4fd',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardInner: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  cardArrow: { fontSize: 18, color: '#6cc04a', fontWeight: '700' },
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

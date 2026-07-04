import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function AboutDanSectionScreen({ route, navigation }) {
  const { section } = route.params || {};
  const title = section?.title || 'Secțiune';

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>Conținutul pentru „{title}" va veni aici. Spune-mi ce vrei să includ: text, video, link-uri.</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  background: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1c2b3a', letterSpacing: -0.3, flex: 1 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardText: { fontSize: 14, color: '#5b6a7a', lineHeight: 20 },
});

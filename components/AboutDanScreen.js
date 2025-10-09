import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function AboutDanScreen({ navigation }) {
  const items = [
    { id: 'intro', title: 'Intro', icon: '📘' },
    { id: 'cine', title: 'Cine sunt eu?', icon: '🧑‍⚕️' },
    { id: 'experienta', title: 'Din experiența mea', icon: '🧭' },
  ];

  const openItem = (it) => {
    if (it.id === 'intro') {
      navigation.navigate('AboutDanIntro');
    } else if (it.id === 'cine') {
      navigation.navigate('AboutDanCineVideo');
    } else {
      navigation.navigate('AboutDanSection', { section: it });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Eu sunt Dan fost anxios</Text>
            <Text style={styles.subtitle}>Alege o secțiune</Text>
          </View>

          {items.map(it => (
            <TouchableOpacity key={it.id} style={styles.card} onPress={() => openItem(it)}>
              <LinearGradient colors={["#ffffff", "#f8fdff"]} style={styles.cardInner}>
                <Text style={styles.cardIcon}>{it.icon}</Text>
                <Text style={styles.cardTitle}>{it.title}</Text>
                <Text style={styles.cardArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
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
    marginTop: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e8f4fd',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardInner: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  cardArrow: { fontSize: 18, color: '#4a90e2', fontWeight: '700' },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function AboutDanScreen({ navigation }) {
  const items = [
    { id: 'intro', title: 'Intro', subtitle: 'Prezentare generală', iconName: 'book-outline', iconColor: '#2f73d8', iconBg: '#eaf3ff' },
    { id: 'cine', title: 'Cine sunt eu?', subtitle: 'Povestea lui Dan', iconName: 'person-circle-outline', iconColor: '#9b59b6', iconBg: '#f5eeff' },
    { id: 'experienta', title: 'Din experiența mea', subtitle: 'Lecții personale', iconName: 'compass-outline', iconColor: '#1f9d91', iconBg: '#e6f9f7' },
  ];

  const openItem = (it) => {
    if (it.id === 'intro') {
      navigation.navigate('AboutDanIntro');
    } else if (it.id === 'cine') {
      navigation.navigate('AboutDanCineVideo');
    } else if (it.id === 'experienta') {
      navigation.navigate('DinExperientaMea');
    } else {
      navigation.navigate('AboutDanSection', { section: it });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#dfeeff", "#f4f9ff", "#edf8f4"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Eu sunt Dan</Text>
          </View>

          <Text style={styles.sectionLabel}>SECȚIUNI</Text>
          <View style={styles.group}>
            {items.map((it, index) => (
              <React.Fragment key={it.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity style={styles.row} onPress={() => openItem(it)} activeOpacity={0.7}>
                  <View style={[styles.iconWrap, { backgroundColor: it.iconBg }]}>
                    <Ionicons name={it.iconName} size={20} color={it.iconColor} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{it.title}</Text>
                    <Text style={styles.rowSubtitle}>{it.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#dfeeff" },
  background: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(117,154,194,0.18)",
    shadowColor: "#2f73d8", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#18324f", letterSpacing: -0.3 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#7d93aa", letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  group: {
    backgroundColor: "rgba(255,255,255,0.86)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(117,154,194,0.18)", overflow: "hidden",
    shadowColor: "#2f73d8", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(117,154,194,0.18)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#18324f", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#7d93aa" },
});

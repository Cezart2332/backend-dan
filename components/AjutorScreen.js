import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

export default function AjutorScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#dfeeff", "#f4f9ff", "#edf8f4"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ai nevoie de ajutor?</Text>
          </View>

          <Text style={styles.sectionLabel}>INTERVENȚIE RAPIDĂ</Text>
          <Text style={styles.intro}>Alege ce simți acum și intră în modul de intervenție.</Text>

          <View style={styles.group}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('AjutorAnxietateList')} activeOpacity={0.7}>
              <View style={[styles.iconWrap, { backgroundColor: "#e8f7ee" }]}>
                <Ionicons name="heart-outline" size={20} color="#3f9f64" />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Am anxietate acum</Text>
                <Text style={styles.rowSubtitle}>Exerciții de calmare rapidă</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('AjutorAtacPanicaList')} activeOpacity={0.7}>
              <View style={[styles.iconWrap, { backgroundColor: "#fff0f0" }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#c94b4b" />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Am atac de panică acum</Text>
                <Text style={styles.rowSubtitle}>Intervenție imediată</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
            </TouchableOpacity>
          </View>
        </ScrollView>
        <HeadphonesDisclaimer />
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
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#7d93aa", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 },
  intro: { fontSize: 14, color: "#58718e", marginBottom: 16, marginLeft: 4, lineHeight: 20 },
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

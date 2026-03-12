import React from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const steps = [
  {
    id: "pas1",
    title: "Pasul 1 din tehnica HAI",
    description: "Identifică semnalele anxietății și setează intenția corectă încă din primele secunde.",
    iconName: "disc-outline",
    iconColor: "#4a90e2",
    iconBg: "#eaf3ff",
    badge: "1",
    video: "pasul_1_tehnica_HAI.mp4",
  },
  {
    id: "pas2",
    title: "Pasul 2 din tehnica HAI",
    description: "Folosește respirația conștientă pentru a-ți calma corpul și a recăpăta ritmul interior.",
    iconName: "disc-outline",
    iconColor: "#5cb85c",
    iconBg: "#e8f7ee",
    badge: "2",
    video: "pasul_2_tehnica_HAI.mp4",
  },
  {
    id: "pas3",
    title: "Pasul 3 din tehnica HAI",
    description: "Transformă dialogul intern și reorientează gândurile anxioase către perspective constructive.",
    iconName: "disc-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
    badge: "3",
    video: "pasul_3_tehnica_HAI.mp4",
  },
  {
    id: "pas4",
    title: "Pasul 4 din tehnica HAI",
    description: "Integrează acțiuni concrete care consolidează starea de calm pe termen lung.",
    iconName: "disc-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
    badge: "4",
    video: "pasul_4_tehnica_HAI.mp4",
  },
  {
    id: "rezumat",
    title: "Rezumatul tehnicii HAI",
    description: "Recapitulează rapid fiecare pas și păstrează un ghid mental la îndemână.",
    iconName: "document-text-outline",
    iconColor: "#2bbbad",
    iconBg: "#e6f9f7",
    video: "rezumat_hai.mp4",
  },
  {
    id: "beneficii",
    title: "Beneficiile tehnicii HAI",
    description: "Descoperă ce rezultate concrete poți obține aplicând constant tehnica.",
    iconName: "star-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
    video: "beneficii_hai.mp4",
  },
  {
    id: "practica",
    title: "Practicarea tehnicii HAI",
    description: "Construiește o rutină zilnică astfel încât HAI să devină un reflex sănătos.",
    iconName: "repeat-outline",
    iconColor: "#4a90e2",
    iconBg: "#eaf3ff",
    video: "practicarea_tehnica_hai.mp4",
  },
  {
    id: "practica_pas1",
    title: "Practicarea pasului 1",
    description: "Exerciții detaliate pentru a stăpâni primul pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#5cb85c",
    iconBg: "#e8f7ee",
    video: "tehnica_hai_practicarea_pasului_1.mp4",
  },
  {
    id: "practica_pas2",
    title: "Practicarea pasului 2",
    description: "Exerciții detaliate pentru a stăpâni al doilea pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
    video: "tehnica_hai_practicarea_pasului_2.mp4",
  },
  {
    id: "context",
    title: "Tehnica HAI în contexte reale",
    description: "Aplică metoda în situații reale: la job, acasă, în trafic sau în relații.",
    iconName: "earth-outline",
    iconColor: "#2bbbad",
    iconBg: "#e6f9f7",
    video: "tehnica_hai_in_contexte_reale.mp4",
  },
];

const audioPackages = [
  {
    id: "audio-psihologice",
    title: "Aplicarea tehnicii HAI în stările psihologice",
    note: "Ghidaje audio pentru gânduri intruzive, teamă de anticipare și anxietate socială.",
    iconName: "bulb-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
    screen: "TehnicaHAIPsihologice",
  },
  {
    id: "audio-fizice",
    title: "Aplicarea tehnicii HAI în stările fizice",
    note: "Exerciții audio dedicate palpitațiilor, tensiunii musculare și senzațiilor corporale intense.",
    iconName: "heart-outline",
    iconColor: "#d9534f",
    iconBg: "#fdf0f0",
    screen: "TehnicaHAIFizice",
  },
];

export default function TehniciScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tehnica HAI</Text>
          </View>

          <Text style={styles.sectionLabel}>PAȘII METODEI</Text>
          <View style={styles.group}>
            {steps.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate("IntelegeAnxietateVideo", { title: item.title, videoFile: item.video })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    {item.badge ? (
                      <Text style={[styles.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
                    ) : (
                      <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                    )}
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>PACHETE AUDIO</Text>
          <View style={styles.group}>
            {audioPackages.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>{item.note}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ddeeff" },
  background: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(74,144,226,0.15)",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a2d45", letterSpacing: -0.3 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8ca8c4", letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 },
  group: {
    backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)", overflow: "hidden",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(200,220,240,0.5)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  badgeText: { fontSize: 16, fontWeight: "800" },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1a2d45", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#8ca8c4", lineHeight: 17 },
});

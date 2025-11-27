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
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const steps = [
  {
    id: "pas1",
    title: "Pasul 1 din tehnica HAI",
    description:
      "Identifică semnalele anxietății și setează intenția corectă încă din primele secunde.",
    emoji: "①",
    video: "pasul_1_tehnica_HAI.mp4",
  },
  {
    id: "pas2",
    title: "Pasul 2 din tehnica HAI",
    description:
      "Folosește respirația conștientă pentru a-ți calma corpul și a recăpăta ritmul interior.",
    emoji: "②",
    video: "pasul_2_tehnica_HAI.mp4",
  },
  {
    id: "pas3",
    title: "Pasul 3 din tehnica HAI",
    description:
      "Transformă dialogul intern și reorientează gândurile anxioase către perspective constructive.",
    emoji: "③",
    video: "pasul_3_tehnica_HAI.mp4",
  },
  {
    id: "pas4",
    title: "Pasul 4 din tehnica HAI",
    description:
      "Integrează acțiuni concrete care consolidează starea de calm pe termen lung.",
    emoji: "④",
    video: "pasul_4_tehnica_HAI.mp4",
  },
  {
    id: "rezumat",
    title: "Rezumatul tehnicii HAI",
    description:
      "Recapitulează rapid fiecare pas și păstrează un ghid mental la îndemână.",
    emoji: "📝",
    video: "rezumat_hai.mp4",
  },
  {
    id: "beneficii",
    title: "Beneficiile tehnicii HAI",
    description:
      "Descoperă ce rezultate concrete poți obține aplicând constant tehnica.",
    emoji: "✨",
    video: "beneficii_hai.mp4",
  },
  {
    id: "practica",
    title: "Practicarea tehnicii HAI",
    description:
      "Construiește o rutină zilnică astfel încât HAI să devină un reflex sănătos.",
    emoji: "🔁",
    video: "practicarea_tehnica_hai.mp4",
  },
  {
    id: "context",
    title: "Tehnica HAI în contexte reale",
    description:
      "Aplică metoda în situații reale: la job, acasă, în trafic sau în relații.",
    emoji: "🌍",
    video: "tehnica_hai_in_contexte_reale.mp4",
  },
];

const audioPackages = [
  {
    id: "audio-psihologice",
    title: "Aplicarea tehnicii HAI în stările psihologice",
    note: "Ghidaje audio pentru gânduri intruzive, teamă de anticipare și anxietate socială.",
    emoji: "🧠",
  },
  {
    id: "audio-fizice",
    title: "Aplicarea tehnicii HAI în stările fizice",
    note: "Exerciții audio dedicate palpitațiilor, tensiunii musculare și senzațiilor corporale intense.",
    emoji: "🫀",
  },
];

export default function TehniciScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Tehnica HAI – metoda completă</Text>

          <Text style={styles.sectionTitle}>Pașii metodei</Text>
          {steps.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("IntelegeAnxietateVideo", {
                  title: item.title,
                  videoFile: item.video,
                })
              }
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardText}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.description}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Pachete de audio-uri</Text>
          {audioPackages.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("TehnicaHAIDetail", {
                  title: item.title,
                  description: item.note,
                  note: "Ascultă cu căști pentru a aprofunda experiența.",
                })
              }
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardText}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.note}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
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
  content: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8f4fd",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTextContainer: { flex: 1, paddingRight: 12 },
  emoji: { fontSize: 22, marginRight: 12, marginTop: 2 },
  cardText: {
    fontSize: 15,
    color: "#2c3e50",
    fontWeight: "600",
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 13, color: "#6c7b84", lineHeight: 18 },
  arrow: { fontSize: 18, color: "#4a90e2", fontWeight: "700", marginTop: 4 },
  backBtn: {
    alignSelf: "center",
    marginTop: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  backText: { color: "#2c3e50", fontWeight: "600" },
});

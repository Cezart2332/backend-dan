import React from "react";
import { Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const options = [
  {
    id: "anxietate",
    title: "Audio-uri despre anxietate",
    description:
      "Explicații și ghidaje pentru a înțelege anxietatea la nivel profund.",
    emoji: "🎙️",
    video: "beneficii_hai.mp4",
  },
  {
    id: "panica",
    title: "Audio-uri despre atacuri de panică",
    description: "Resurse audio dedicate gestionării atacurilor de panică.",
    emoji: "💬",
    video: "senzatia de capcana.mp4",
  },
];

export default function IntelegeAnxietateScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Înțelege anxietatea</Text>
          <Text style={styles.subtitle}>
            Alege categoria potrivită și vizionează introducerea video înainte
            de a accesa audio-urile.
          </Text>
          {options.map((item) => (
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
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.description}</Text>
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
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#6c7b84",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e8f4fd",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emoji: { fontSize: 24, marginBottom: 12 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6c7b84",
    marginBottom: 10,
    lineHeight: 18,
  },
  arrow: {
    fontSize: 18,
    color: "#4a90e2",
    fontWeight: "700",
    textAlign: "right",
  },
  backBtn: {
    alignSelf: "center",
    marginTop: 20,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  backText: { color: "#2c3e50", fontWeight: "600" },
});

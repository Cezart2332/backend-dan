import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const videos = [
  {
    id: "ganduri_anxioase",
    title: "Gânduri anxioase",
    videoFile: "tehnica_hai_in_starile_psiholgice_ganduri_anxioase.mp4",
    icon: "💭",
  },
  {
    id: "ganduri_tulburatoare",
    title: "Gânduri tulburătoare",
    videoFile: "tehnica_hai_in_stari_psihologice_ganduri_tulburato.mp4",
    icon: "🌀",
  },
  {
    id: "depresie_anxietate",
    title: "Depresie în anxietate",
    videoFile: "tehnica_hai_in_stari_psihologice_depresie_in_anxie.mp4",
    icon: "🌧️",
  },
  {
    id: "senzatia_irealitate",
    title: "Senzația de irealitate",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatia_irealitate.mp4",
    icon: "🌫️",
  },
  {
    id: "pierdere_control",
    title: "Senzație de pierdere a controlului",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatie_de_pierdere_a_controlului.mp4",
    icon: "🎢",
  },
  {
    id: "teama_innebuni",
    title: "Teama că vei înnebuni",
    videoFile: "tehnica_hai_in_starile_psihologice_teama_ca_vei_innebunii.mp4",
    icon: "😰",
  },
];

export default function TehnicaHAIPsihologiceScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Tehnica HAI în stările psihologice</Text>
            <Text style={styles.subtitle}>
              Ghidaje audio pentru gânduri intruzive, teamă și anxietate
            </Text>
          </View>

          {videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("TehnicaHAIVideo", {
                  title: item.title,
                  videoFile: item.videoFile,
                })
              }
            >
              <LinearGradient
                colors={["#ffffff", "#f0f8ff"]}
                style={styles.cardInner}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
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
  header: { alignItems: "center", marginBottom: 16 },
  backBtn: {
    position: "absolute",
    left: 0,
    top: -2,
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    elevation: 3,
  },
  backIcon: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginTop: 30,
  },
  subtitle: {
    fontSize: 13,
    color: "#6c7b84",
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardInner: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  cardArrow: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
});

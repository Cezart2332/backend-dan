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
    id: "esti_in_siguranta",
    title: "Ești în siguranță",
    videoFile: "ajutor_atac_de_panica_esti_in_siguranta.mp4",
    icon: "🛡️",
  },
  {
    id: "provoaca_atacul",
    title: "Provoacă atacul de panică",
    videoFile: "ajutor_atac_de_panica_provoaca_atacul_de_panica.mp4",
    icon: "💪",
  },
  {
    id: "sigur_nu_voi_pati",
    title: "Sigur nu voi păți ceva rău",
    videoFile: "ajutor_atac_panica_sigur_nu_voi_pati_ceva_rau.mp4",
    icon: "✅",
  },
  {
    id: "trebuie_sa_accept",
    title: "Trebuie să accept anxietatea",
    videoFile: "ajutor_atac_panica_trebuie_sa_accept_anxietatea.mp4",
    icon: "🧘",
  },
  {
    id: "sos_mai_poti",
    title: "SOS - Mai poți 1 minut",
    videoFile: "ajutor_sos_am_atac_de_panica_mai_poti_1_min.mp4",
    icon: "🆘",
  },
];

export default function AjutorAtacPanicaListScreen({ navigation }) {
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
            <Text style={styles.title}>Ajutor - am atac de panică acum</Text>
            <Text style={styles.subtitle}>
              Alege un video de ajutor pentru atacurile de panică
            </Text>
          </View>

          {videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("AjutorAtacPanicaVideo", {
                  title: item.title,
                  videoFile: item.videoFile,
                })
              }
            >
              <LinearGradient
                colors={["#ffffff", "#fff3f3"]}
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
    fontSize: 20,
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
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#2c3e50" },
  cardArrow: { fontSize: 18, color: "#e74c3c", fontWeight: "700" },
});

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
    id: "intro",
    title: "Intro",
    videoFile: "intelege_anxietatea_intro.mp4",
    icon: "👋",
  },
  {
    id: "ganduri_si_emotii",
    title: "Gânduri și emoții",
    videoFile: "intelege_anxietatea_ganduri_si_emotii.mp4",
    icon: "💭",
  },
  {
    id: "aspecte_esentiale",
    title: "Aspecte esențiale",
    videoFile: "intelege_anxietatea_aspecte_esentiale.mp4",
    icon: "⭐",
  },
  {
    id: "diferenta",
    title: "Diferența între anxietatea normală și cea patologică",
    videoFile: "intelege_anxietatea_diferenta_intre_anxietatea_normala_si_cea_patologica.mp4",
    icon: "⚖️",
  },
  {
    id: "elimina_patologica",
    title: "Elimină anxietatea patologică",
    videoFile: "intelege_anxietatea_elimina_anxietatea_patologica.mp4",
    icon: "🚧",
  },
  {
    id: "greseli_comune",
    title: "Greșeli comune",
    videoFile: "intelege_anxietatea_greseli_comune.mp4",
    icon: "⚠️",
  },
  {
    id: "greseli_acceptare_1",
    title: "Greșeli în acceptarea anxietății (1)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii.mp4",
    icon: "1️⃣",
  },
  {
    id: "greseli_acceptare_2",
    title: "Greșeli în acceptarea anxietății (2)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part2.mp4",
    icon: "2️⃣",
  },
  {
    id: "greseli_acceptare_3",
    title: "Greșeli în acceptarea anxietății (3)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part3.mp4",
    icon: "3️⃣",
  },
  {
    id: "greseli_acceptare_4",
    title: "Greșeli în acceptarea anxietății (4)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part4.mp4",
    icon: "4️⃣",
  },
  {
    id: "greseli_acceptare_5",
    title: "Greșeli în acceptarea anxietății (5)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part5.mp4",
    icon: "5️⃣",
  },
  {
    id: "insomnia",
    title: "Insomnia",
    videoFile: "intelege_anxietatea_insomnia.mp4",
    icon: "😴",
  },
  {
    id: "legatura_supravietuire",
    title: "Legătura între anxietate și răspunsul de supraviețuire",
    videoFile: "intelege_anxietatea_legatura_intre_anxietate_si_raspunsul_de_supravietuire.mp4",
    icon: "🔗",
  },
  {
    id: "nu_poti_face_avc",
    title: "Nu poți face AVC",
    videoFile: "intelege_anxietatea_nu_poti_face_AVC.mp4",
    icon: "🧠",
  },
];

export default function AudioAnxietateListScreen({ navigation }) {
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
            <Text style={styles.title}>Audio-uri despre anxietate</Text>
            <Text style={styles.subtitle}>
              Explicații și ghidaje pentru a înțelege anxietatea la nivel profund
            </Text>
          </View>

          {videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("AudioAnxietateVideo", {
                  title: item.title,
                  videoFile: item.videoFile,
                })
              }
            >
              <LinearGradient
                colors={["#ffffff", "#f8f0ff"]}
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
  cardArrow: { fontSize: 18, color: "#9b59b6", fontWeight: "700" },
});

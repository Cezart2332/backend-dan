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
    id: "incurajare",
    title: "Încurajare",
    videoFile: "din_experienta_mea_incurajare.mp4",
    icon: "💪",
  },
  {
    id: "frica_cumparaturi",
    title: "Frica de cumpărături",
    videoFile: "din_experienta_mea_frica_cumparaturi.mp4",
    icon: "🛒",
  },
  {
    id: "frica_performanta",
    title: "Frica de performanță",
    videoFile: "din_experienta_mea_frica_performanta.mp4",
    icon: "🎯",
  },
  {
    id: "frica_volan",
    title: "Frica de volan",
    videoFile: "din_experienta_mea_frica_volan.mp4",
    icon: "🚗",
  },
  {
    id: "senzatia_capcana",
    title: "Senzația de capcană",
    videoFile: "din_experienta_mea_senzatia_de_capcana.mp4",
    icon: "🔒",
  },
  {
    id: "furnicaturi",
    title: "Furnicături",
    videoFile: "din_experienta_mea_furnicaturi.mp4",
    icon: "✨",
  },
  {
    id: "slabiciune_picioare",
    title: "Slăbiciune în picioare",
    videoFile: "din_experienta_mea_slabiciune_in_picioare.mp4",
    icon: "🦵",
  },
];

export default function DinExperientaMeaScreen({ navigation }) {
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
            <Text style={styles.title}>Din experiența mea</Text>
            <Text style={styles.subtitle}>
              Povești și lecții din propria mea experiență cu anxietatea
            </Text>
          </View>

          {videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("DinExperientaMeaVideo", {
                  title: item.title,
                  videoFile: item.videoFile,
                })
              }
            >
              <LinearGradient
                colors={["#ffffff", "#f8fdff"]}
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
  cardArrow: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
});

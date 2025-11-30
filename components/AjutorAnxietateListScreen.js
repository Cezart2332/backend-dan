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
    id: "ce_sa_fac",
    title: "Ce să mă fac cu stările?",
    videoFile: "ajutor_anxietate_ce_sa_ma_fac_cu_starile.mp4",
    icon: "💭",
  },
  {
    id: "confrunta_frica",
    title: "Confruntă frica",
    videoFile: "ajutor_am_anxietate_acum_confrunta_frica.mp4",
    icon: "💪",
  },
  {
    id: "recadere",
    title: "Am o recădere",
    videoFile: "ajutor_anxietate_am_o_recadere.mp4",
    icon: "🔄",
  },
];

export default function AjutorAnxietateListScreen({ navigation }) {
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
            <Text style={styles.title}>Ajutor - am anxietate acum</Text>
            <Text style={styles.subtitle}>
              Alege un video de ajutor pentru momentele de anxietate
            </Text>
          </View>

          {videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("AjutorAnxietateVideo", {
                  title: item.title,
                  videoFile: item.videoFile,
                })
              }
            >
              <LinearGradient
                colors={["#ffffff", "#f3fff3"]}
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
  cardArrow: { fontSize: 18, color: "#6cc04a", fontWeight: "700" },
});

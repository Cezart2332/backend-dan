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
import { Ionicons } from "@expo/vector-icons";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const videos = [
  {
    id: "incurajare",
    title: "Încurajare",
    videoFile: "din_experienta_mea_incurajare.mp4",
    iconName: "barbell-outline",
    iconColor: "#4a90e2",
    iconBg: "#eaf3ff",
  },
  {
    id: "frica_cumparaturi",
    title: "Frica de cumpărături",
    videoFile: "din_experienta_mea_frica_cumparaturi.mp4",
    iconName: "cart-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
  },
  {
    id: "frica_performanta",
    title: "Frica de performanță",
    videoFile: "din_experienta_mea_frica_performanta.mp4",
    iconName: "trophy-outline",
    iconColor: "#9b59b6",
    iconBg: "#f5eeff",
  },
  {
    id: "frica_volan",
    title: "Frica de volan",
    videoFile: "din_experienta_mea_frica_volan.mp4",
    iconName: "car-outline",
    iconColor: "#5cb85c",
    iconBg: "#e8f7ee",
  },
  {
    id: "senzatia_capcana",
    title: "Senzația de capcană",
    videoFile: "din_experienta_mea_senzatia_de_capcana.mp4",
    iconName: "lock-closed-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
  },
  {
    id: "furnicaturi",
    title: "Furnicături",
    videoFile: "din_experienta_mea_furnicaturi.mp4",
    iconName: "flash-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
  },
  {
    id: "slabiciune_picioare",
    title: "Slăbiciune în picioare",
    videoFile: "din_experienta_mea_slabiciune_in_picioare.mp4",
    iconName: "walk-outline",
    iconColor: "#2bbbad",
    iconBg: "#e6f9f7",
  },
];

export default function DinExperientaMeaScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Din experiența mea</Text>
          </View>

          <Text style={styles.sectionLabel}>POVEȘTI PERSONALE</Text>
          <Text style={styles.intro}>Lecții și povești din propria experiență cu anxietatea</Text>

          <View style={styles.group}>
            {videos.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate("DinExperientaMeaVideo", {
                      title: item.title,
                      videoFile: item.videoFile,
                      nowPlayingTitle: item.title,
                      nowPlayingArtist: "Dan fost anxios · Experiențe reale",
                      nowPlayingAccent: item.iconColor,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                  </View>
                  <Text style={styles.rowTitle}>{item.title}</Text>
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
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8ca8c4", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 },
  intro: { fontSize: 14, color: "#6c8096", marginBottom: 16, marginLeft: 4, lineHeight: 20 },
  group: {
    backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)", overflow: "hidden",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(200,220,240,0.5)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1a2d45" },
});

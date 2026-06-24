import React, { useState, useEffect } from "react";
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
import { api } from "../utils/api";
import { useSubscription } from "../contexts/SubscriptionContext";

const videos = [
  {
    id: "intro",
    title: "Intro",
    videoFile: "intelege_anxietatea_intro.mp4",
    iconName: "hand-left-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "ganduri_si_emotii",
    title: "Gânduri și emoții",
    videoFile: "intelege_anxietatea_ganduri_si_emotii.mp4",
    iconName: "chatbubble-ellipses-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
  },
  {
    id: "aspecte_esentiale",
    title: "Aspecte esențiale",
    videoFile: "intelege_anxietatea_aspecte_esentiale.mp4",
    iconName: "star-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
  },
  {
    id: "diferenta",
    title: "Diferența între anxietatea normală și cea patologică",
    videoFile: "intelege_anxietatea_diferenta_intre_anxietatea_normala_si_cea_patologica.mp4",
    iconName: "resize-outline",
    iconColor: "#1f9d91",
    iconBg: "#e6f9f7",
  },
  {
    id: "elimina_patologica",
    title: "Elimină anxietatea patologică",
    videoFile: "intelege_anxietatea_elimina_anxietatea_patologica.mp4",
    iconName: "construct-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
  },
  {
    id: "greseli_comune",
    title: "Greșeli comune",
    videoFile: "intelege_anxietatea_greseli_comune.mp4",
    iconName: "warning-outline",
    iconColor: "#c94b4b",
    iconBg: "#fdf0f0",
  },
  {
    id: "greseli_acceptare_1",
    title: "Greșeli în acceptarea anxietății (1)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii.mp4",
    iconName: "document-text-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "greseli_acceptare_2",
    title: "Greșeli în acceptarea anxietății (2)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part2.mp4",
    iconName: "document-text-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "greseli_acceptare_3",
    title: "Greșeli în acceptarea anxietății (3)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part3.mp4",
    iconName: "document-text-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "greseli_acceptare_4",
    title: "Greșeli în acceptarea anxietății (4)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part4.mp4",
    iconName: "document-text-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "greseli_acceptare_5",
    title: "Greșeli în acceptarea anxietății (5)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part5.mp4",
    iconName: "document-text-outline",
    iconColor: "#2f73d8",
    iconBg: "#eaf3ff",
  },
  {
    id: "insomnia",
    title: "Insomnia",
    videoFile: "intelege_anxietatea_insomnia.mp4",
    iconName: "moon-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
  },
  {
    id: "legatura_supravietuire",
    title: "Legătura între anxietate și răspunsul de supraviețuire",
    videoFile: "intelege_anxietatea_legatura_intre_anxietate_si_raspunsul_de_supravietuire.mp4",
    iconName: "link-outline",
    iconColor: "#3f9f64",
    iconBg: "#e8f7ee",
  },
  {
    id: "nu_poti_face_avc",
    title: "Nu poți face AVC",
    videoFile: "intelege_anxietatea_nu_poti_face_AVC.mp4",
    iconName: "pulse-outline",
    iconColor: "#c94b4b",
    iconBg: "#fdf0f0",
  },
];

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function AudioAnxietateListScreen({ navigation }) {
  const [cmsSubsections, setCmsSubsections] = useState([]);
  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    api.getCmsVideoSection('audio-anxietate')
      .then((data) => setCmsSubsections(data.subsections || []))
      .catch((err) => console.warn('[CMS] audio-anxietate:', err));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#dfeeff", "#f4f9ff", "#edf8f4"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Audio despre anxietate</Text>
          </View>

          <Text style={styles.sectionLabel}>LECȚII AUDIO</Text>
          <Text style={styles.intro}>Explicații și ghidaje pentru a înțelege anxietatea la nivel profund</Text>

          <View style={styles.group}>
            {videos.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate("AudioAnxietateVideo", {
                      title: item.title,
                      videoFile: item.videoFile,
                      nowPlayingTitle: item.title,
                      nowPlayingArtist: "Dan fost anxios · Audio anxietate",
                      nowPlayingAccent: item.iconColor,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                  </View>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {hasPaidSub ? (
            cmsSubsections.map((sub) => (
              <View key={`cms-sub-${sub.id}`}>
                <Text style={[styles.sectionLabel, { marginTop: 28 }]}>{sub.title.toUpperCase()}</Text>
                <View style={styles.group}>
                  {sub.videos.map((item, index) => (
                    <React.Fragment key={`cms-${item.id}`}>
                      {index > 0 && <View style={styles.separator} />}
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() =>
                          navigation.navigate("AudioAnxietateVideo", {
                            title: item.title,
                            videoFile: `${item.storage_key}.mp4`,
                            nowPlayingTitle: item.title,
                            nowPlayingArtist: `Dan fost anxios · ${sub.title}`,
                            nowPlayingAccent: sub.icon_color || "#2f73d8",
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: sub.icon_bg || "#eaf3ff" }]}>
                          <Ionicons name={sub.icon_name || "play-outline"} size={20} color={sub.icon_color || "#2f73d8"} />
                        </View>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#94a9bf" />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))
          ) : (
            cmsSubsections.length > 0 && (
              <View style={styles.lockCard}>
                <Ionicons name="lock-closed-outline" size={28} color="#f0a500" />
                <Text style={styles.lockTitle}>Conținut extra disponibil</Text>
                <Text style={styles.lockDesc}>Acest conținut este disponibil doar cu un abonament activ.</Text>
                <TouchableOpacity
                  style={styles.lockBtn}
                  onPress={() => navigation.navigate("Subscriptions")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.lockBtnText}>Vezi abonamente</Text>
                </TouchableOpacity>
              </View>
            )
          )}
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
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#18324f" },
  lockCard: {
    marginTop: 28, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.86)", borderWidth: 1, borderColor: "rgba(117,154,194,0.18)",
    padding: 20, alignItems: "center",
    shadowColor: "#2f73d8", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  lockTitle: { fontSize: 15, fontWeight: "700", color: "#18324f", marginTop: 10 },
  lockDesc: { fontSize: 13, color: "#58718e", textAlign: "center", marginTop: 4, lineHeight: 18 },
  lockBtn: {
    marginTop: 14, backgroundColor: "#2f73d8", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  lockBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

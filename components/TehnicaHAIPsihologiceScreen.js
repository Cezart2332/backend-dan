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
    id: "ganduri_anxioase",
    title: "Gânduri anxioase",
    videoFile: "tehnica_hai_in_starile_psiholgice_ganduri_anxioase.mp4",
    iconName: "chatbubble-outline",
    iconColor: "#4a90e2",
    iconBg: "#eaf3ff",
  },
  {
    id: "ganduri_tulburatoare",
    title: "Gânduri tulburătoare",
    videoFile: "tehnica_hai_in_stari_psihologice_ganduri_tulburato.mp4",
    iconName: "sync-circle-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
  },
  {
    id: "depresie_anxietate",
    title: "Depresie în anxietate",
    videoFile: "tehnica_hai_in_stari_psihologice_depresie_in_anxie.mp4",
    iconName: "cloudy-outline",
    iconColor: "#5a7a95",
    iconBg: "#edf4fb",
  },
  {
    id: "senzatia_irealitate",
    title: "Senzația de irealitate",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatia_irealitate.mp4",
    iconName: "contrast-outline",
    iconColor: "#2bbbad",
    iconBg: "#e6f9f7",
  },
  {
    id: "pierdere_control",
    title: "Senzație de pierdere a controlului",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatie_de_pierdere_a_controlului.mp4",
    iconName: "infinite-outline",
    iconColor: "#f0a500",
    iconBg: "#fff7e6",
  },
  {
    id: "teama_innebuni",
    title: "Teama că vei înnebuni",
    videoFile: "tehnica_hai_in_starile_psihologice_teama_ca_vei_innebunii.mp4",
    iconName: "help-circle-outline",
    iconColor: "#d9534f",
    iconBg: "#fff0f0",
  },
];

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function TehnicaHAIPsihologiceScreen({ navigation }) {
  const [cmsSubsections, setCmsSubsections] = useState([]);

  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    api.getCmsVideoSection('tehnica-hai-psihologice')
      .then((data) => setCmsSubsections(data.subsections || []))
      .catch((err) => console.warn('[CMS] tehnica-hai-psihologice:', err));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>HAI – Stări psihologice</Text>
          </View>

          <Text style={styles.sectionLabel}>AUDIO-URI GHIDATE</Text>
          <Text style={styles.intro}>Ghidaje pentru gânduri intruzive, teamă și anxietate</Text>

          <View style={styles.group}>
            {videos.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate("TehnicaHAIVideo", {
                      title: item.title,
                      videoFile: item.videoFile,
                      nowPlayingTitle: item.title,
                      nowPlayingArtist: "Dan fost anxios · HAI stări psihologice",
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
                          navigation.navigate("TehnicaHAIVideo", {
                            title: item.title,
                            videoFile: `${item.storage_key}.mp4`,
                            nowPlayingTitle: item.title,
                            nowPlayingArtist: `Dan fost anxios · ${sub.title}`,
                            nowPlayingAccent: sub.icon_color || "#8e44ad",
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: sub.icon_bg || "#f5eeff" }]}>
                          <Ionicons name={sub.icon_name || "play-outline"} size={20} color={sub.icon_color || "#8e44ad"} />
                        </View>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
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
  lockCard: {
    marginTop: 28, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
    padding: 20, alignItems: "center",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  lockTitle: { fontSize: 15, fontWeight: "700", color: "#1a2d45", marginTop: 10 },
  lockDesc: { fontSize: 13, color: "#6c8096", textAlign: "center", marginTop: 4, lineHeight: 18 },
  lockBtn: {
    marginTop: 14, backgroundColor: "#4a90e2", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  lockBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

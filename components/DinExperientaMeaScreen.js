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
import { Feather, Ionicons } from "@expo/vector-icons";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";
import { api } from "../utils/api";
import { useSubscription } from "../contexts/SubscriptionContext";

const videos = [
  {
    id: "incurajare",
    title: "Încurajare",
    videoFile: "din_experienta_mea_incurajare.mp4",
    iconName: "barbell-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "frica_cumparaturi",
    title: "Frica de cumpărături",
    videoFile: "din_experienta_mea_frica_cumparaturi.mp4",
    iconName: "cart-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "frica_performanta",
    title: "Frica de performanță",
    videoFile: "din_experienta_mea_frica_performanta.mp4",
    iconName: "trophy-outline",
    iconColor: "#6d6b8f",
    iconBg: "#ececf2",
  },
  {
    id: "frica_volan",
    title: "Frica de volan",
    videoFile: "din_experienta_mea_frica_volan.mp4",
    iconName: "car-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
  {
    id: "senzatia_capcana",
    title: "Senzația de capcană",
    videoFile: "din_experienta_mea_senzatia_de_capcana.mp4",
    iconName: "lock-closed-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "furnicaturi",
    title: "Furnicături",
    videoFile: "din_experienta_mea_furnicaturi.mp4",
    iconName: "flash-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "slabiciune_picioare",
    title: "Slăbiciune în picioare",
    videoFile: "din_experienta_mea_slabiciune_in_picioare.mp4",
    iconName: "walk-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
];

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function DinExperientaMeaScreen({ navigation }) {
  const [cmsSubsections, setCmsSubsections] = useState([]);

  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    api.getCmsVideoSection('din-experienta-mea')
      .then((data) => setCmsSubsections(data.subsections || []))
      .catch((err) => console.warn('[CMS] din-experienta-mea:', err));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color="#24384e" />
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
                  <Feather name="chevron-right" size={18} color="#9aa5b1" />
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
                          navigation.navigate("DinExperientaMeaVideo", {
                            title: item.title,
                            videoFile: `${item.storage_key}.mp4`,
                            nowPlayingTitle: item.title,
                            nowPlayingArtist: `Dan fost anxios · ${sub.title}`,
                            nowPlayingAccent: sub.icon_color || "#24384e",
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: sub.icon_bg || "#e8ebef" }]}>
                          <Ionicons name={sub.icon_name || "play-outline"} size={20} color={sub.icon_color || "#24384e"} />
                        </View>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Feather name="chevron-right" size={18} color="#9aa5b1" />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))
          ) : (
            cmsSubsections.length > 0 && (
              <View style={styles.lockCard}>
                <Feather name="lock" size={28} color="#b3924f" />
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
  safeArea: { flex: 1, backgroundColor: "#f6f7f8" },
  background: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(32,47,62,0.18)",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1c2b3a", letterSpacing: -0.3 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8a97a5", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 },
  intro: { fontSize: 14, color: "#5b6a7a", marginBottom: 16, marginLeft: 4, lineHeight: 20 },
  group: {
    backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(32,47,62,0.18)", overflow: "hidden",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(32,47,62,0.18)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1c2b3a" },
  lockCard: {
    marginTop: 28, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.58)", borderWidth: 1, borderColor: "rgba(32,47,62,0.18)",
    padding: 20, alignItems: "center",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  lockTitle: { fontSize: 15, fontWeight: "700", color: "#1c2b3a", marginTop: 10 },
  lockDesc: { fontSize: 13, color: "#5b6a7a", textAlign: "center", marginTop: 4, lineHeight: 18 },
  lockBtn: {
    marginTop: 14, backgroundColor: "#24384e", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  lockBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

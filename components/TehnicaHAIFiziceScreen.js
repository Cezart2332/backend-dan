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
import { useTheme, useThemedStyles } from "./ui/themeContext";

const videos = [
  {
    id: "ameteala",
    title: "Amețeala",
    videoFile: "tehnica_hai_in_starile_fizice_ameteala.mp4",
    iconName: "eye-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "echilibrul",
    title: "Echilibrul",
    videoFile: "tehnica_hai_in_starile_fizice_echilibrul.mp4",
    iconName: "resize-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
  {
    id: "rezultate_normale",
    title: "Rezultate normale",
    videoFile: "tehnica_hai_in_starile_fizice_rezultate_normale.mp4",
    iconName: "checkmark-circle-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
];

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function TehnicaHAIFiziceScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [cmsSubsections, setCmsSubsections] = useState([]);

  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    api.getCmsVideoSection('tehnica-hai-fizice')
      .then((data) => setCmsSubsections(data.subsections || []))
      .catch((err) => console.warn('[CMS] tehnica-hai-fizice:', err));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc("#f6f7f8", 'bg'), tc("#f3f4f6", 'bg'), tc("#eef0f2", 'bg')]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>HAI – Stări fizice</Text>
          </View>

          <Text style={styles.sectionLabel}>AUDIO-URI GHIDATE</Text>
          <Text style={styles.intro}>Exerciții pentru senzațiile corporale intense</Text>

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
                      nowPlayingArtist: "Dan fost anxios · HAI stări fizice",
                      nowPlayingAccent: item.iconColor,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: tc(item.iconBg, 'bg') }]}>
                    <Ionicons name={item.iconName} size={20} color={tc(item.iconColor, 'fg')} />
                  </View>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Feather name="chevron-right" size={18} color={tc("#9aa5b1", 'fg')} />
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
                            nowPlayingAccent: sub.icon_color || "#5c5a80",
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: tc(sub.icon_bg, 'bg') || tc("#ececf2", 'bg') }]}>
                          <Ionicons name={sub.icon_name || "play-outline"} size={20} color={tc(sub.icon_color, 'fg') || tc("#5c5a80", 'fg')} />
                        </View>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Feather name="chevron-right" size={18} color={tc("#9aa5b1", 'fg')} />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))
          ) : (
            cmsSubsections.length > 0 && (
              <View style={styles.lockCard}>
                <Feather name="lock" size={28} color={tc("#b3924f", 'fg')} />
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

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc("#f6f7f8", 'bg') },
  background: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: tc("#1c2b3a", 'fg'), letterSpacing: -0.3 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: tc("#8a97a5", 'fg'), letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 },
  intro: { fontSize: 14, color: tc("#5b6a7a", 'fg'), marginBottom: 16, marginLeft: 4, lineHeight: 20 },
  group: {
    backgroundColor: tc("rgba(255,255,255,0.58)", 'bg'), borderRadius: 18,
    borderWidth: 1, borderColor: tc("rgba(32,47,62,0.18)", 'bg'), overflow: "hidden",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: tc("rgba(32,47,62,0.18)", 'bg'), marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: tc("#1c2b3a", 'fg') },
  lockCard: {
    marginTop: 28, borderRadius: 18,
    backgroundColor: tc("rgba(255,255,255,0.58)", 'bg'), borderWidth: 1, borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
    padding: 20, alignItems: "center",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  lockTitle: { fontSize: 15, fontWeight: "700", color: tc("#1c2b3a", 'fg'), marginTop: 10 },
  lockDesc: { fontSize: 13, color: tc("#5b6a7a", 'fg'), textAlign: "center", marginTop: 4, lineHeight: 18 },
  lockBtn: {
    marginTop: 14, backgroundColor: tc("#24384e", 'bg'), borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  lockBtnText: { color: tc("#fff", 'fg'), fontWeight: "700", fontSize: 14 },
});

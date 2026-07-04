import React, { useState, useEffect } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";
import { api } from "../utils/api";
import { useSubscription } from "../contexts/SubscriptionContext";

const steps = [
  {
    id: "pas1",
    title: "Pasul 1 din tehnica HAI",
    description: "Identifică semnalele anxietății și setează intenția corectă încă din primele secunde.",
    iconName: "disc-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
    badge: "1",
    video: "pasul_1_tehnica_HAI.mp4",
  },
  {
    id: "pas2",
    title: "Pasul 2 din tehnica HAI",
    description: "Folosește respirația conștientă pentru a-ți calma corpul și a recăpăta ritmul interior.",
    iconName: "disc-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
    badge: "2",
    video: "pasul_2_tehnica_HAI.mp4",
  },
  {
    id: "pas3",
    title: "Pasul 3 din tehnica HAI",
    description: "Transformă dialogul intern și reorientează gândurile anxioase către perspective constructive.",
    iconName: "disc-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
    badge: "3",
    video: "pasul_3_tehnica_HAI.mp4",
  },
  {
    id: "pas4",
    title: "Pasul 4 din tehnica HAI",
    description: "Integrează acțiuni concrete care consolidează starea de calm pe termen lung.",
    iconName: "disc-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    badge: "4",
    video: "pasul_4_tehnica_HAI.mp4",
  },
  {
    id: "rezumat",
    title: "Rezumatul tehnicii HAI",
    description: "Recapitulează rapid fiecare pas și păstrează un ghid mental la îndemână.",
    iconName: "document-text-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
    video: "rezumat_hai.mp4",
  },
  {
    id: "beneficii",
    title: "Beneficiile tehnicii HAI",
    description: "Descoperă ce rezultate concrete poți obține aplicând constant tehnica.",
    iconName: "star-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
    video: "beneficii_hai.mp4",
  },
  {
    id: "practica",
    title: "Practicarea tehnicii HAI",
    description: "Construiește o rutină zilnică astfel încât HAI să devină un reflex sănătos.",
    iconName: "repeat-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
    video: "practicarea_tehnica_hai.mp4",
  },
  {
    id: "practica_pas1",
    title: "Practicarea pasului 1",
    description: "Exerciții detaliate pentru a stăpâni primul pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
    video: "tehnica_hai_practicarea_pasului_1.mp4",
  },
  {
    id: "practica_pas2",
    title: "Practicarea pasului 2",
    description: "Exerciții detaliate pentru a stăpâni al doilea pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    video: "tehnica_hai_practicarea_pasului_2.mp4",
  },
  {
    id: "context",
    title: "Tehnica HAI în contexte reale",
    description: "Aplică metoda în situații reale: la job, acasă, în trafic sau în relații.",
    iconName: "earth-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
    video: "tehnica_hai_in_contexte_reale.mp4",
  },
];

const audioPackages = [
  {
    id: "audio-psihologice",
    title: "Aplicarea tehnicii HAI în stările psihologice",
    note: "Ghidaje audio pentru gânduri intruzive, teamă de anticipare și anxietate socială.",
    iconName: "bulb-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    screen: "TehnicaHAIPsihologice",
  },
  {
    id: "audio-fizice",
    title: "Aplicarea tehnicii HAI în stările fizice",
    note: "Exerciții audio dedicate palpitațiilor, tensiunii musculare și senzațiilor corporale intense.",
    iconName: "heart-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
    screen: "TehnicaHAIFizice",
  },
];

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function TehniciScreen({ navigation }) {
  const [cmsSubsections, setCmsSubsections] = useState([]);
  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    api.getCmsVideoSection('tehnica-hai')
      .then((data) => setCmsSubsections(data.subsections || []))
      .catch((err) => console.warn('[CMS] tehnica-hai:', err));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tehnica HAI</Text>
          </View>

          <Text style={styles.sectionLabel}>PAȘII METODEI</Text>
          <View style={styles.group}>
            {steps.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate("IntelegeAnxietateVideo", {
                      title: item.title,
                      videoFile: item.video,
                      nowPlayingTitle: item.title,
                      nowPlayingArtist: "Dan fost anxios · Tehnica HAI",
                      nowPlayingAccent: item.iconColor,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    {item.badge ? (
                      <Text style={[styles.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
                    ) : (
                      <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                    )}
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>{item.description}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9aa5b1" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>PACHETE AUDIO</Text>
          <View style={styles.group}>
            {audioPackages.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>{item.note}</Text>
                  </View>
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
                          navigation.navigate("IntelegeAnxietateVideo", {
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
                          {item.badge ? (
                            <Text style={[styles.badgeText, { color: sub.icon_color || "#24384e" }]}>{item.badge}</Text>
                          ) : (
                            <Ionicons name={sub.icon_name || "play-outline"} size={20} color={sub.icon_color || "#24384e"} />
                          )}
                        </View>
                        <View style={styles.rowTextWrap}>
                          <Text style={styles.rowTitle}>{item.title}</Text>
                          {item.description ? <Text style={styles.rowSubtitle} numberOfLines={2}>{item.description}</Text> : null}
                        </View>
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
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8a97a5", letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 },
  group: {
    backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(32,47,62,0.18)", overflow: "hidden",
    shadowColor: "#24384e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(32,47,62,0.18)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  badgeText: { fontSize: 16, fontWeight: "800" },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1c2b3a", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#8a97a5", lineHeight: 17 },
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

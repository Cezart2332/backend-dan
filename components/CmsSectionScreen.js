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

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

export default function CmsSectionScreen({ route, navigation }) {
  const { slug, title } = route.params || {};
  const [cmsData, setCmsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { subscription, hasProEntitlement } = useSubscription();
  const hasPaidSub = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    api.getCmsVideoSection(slug)
      .then((data) => setCmsData(data))
      .catch((err) => console.warn('[CMS] section:', err))
      .finally(() => setLoading(false));
  }, [slug]);

  const sectionTitle = title || cmsData?.section?.title || "Conținut";

  if (!hasPaidSub) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
                <Ionicons name="chevron-back" size={22} color="#4a90e2" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{sectionTitle}</Text>
            </View>
            <View style={styles.lockCard}>
              <Ionicons name="lock-closed-outline" size={36} color="#f0a500" />
              <Text style={styles.lockTitle}>Conținut disponibil cu abonament</Text>
              <Text style={styles.lockDesc}>Acest conținut este disponibil doar cu un abonament activ.</Text>
              <TouchableOpacity
                style={styles.lockBtn}
                onPress={() => navigation.navigate("Subscriptions")}
                activeOpacity={0.8}
              >
                <Text style={styles.lockBtnText}>Vezi abonamente</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <HeadphonesDisclaimer />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{sectionTitle}</Text>
          </View>

          {loading && <Text style={styles.loadingText}>Se încarcă...</Text>}

          {cmsData?.subsections?.map((sub) => (
            <View key={`cms-sub-${sub.id}`}>
              <Text style={styles.sectionLabel}>{sub.title.toUpperCase()}</Text>
              {sub.description ? <Text style={styles.intro}>{sub.description}</Text> : null}
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
                          nowPlayingAccent: sub.icon_color || "#4a90e2",
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: sub.icon_bg || "#eaf3ff" }]}>
                        {item.badge ? (
                          <Text style={[styles.badgeText, { color: sub.icon_color || "#4a90e2" }]}>{item.badge}</Text>
                        ) : (
                          <Ionicons name={sub.icon_name || "play-outline"} size={20} color={sub.icon_color || "#4a90e2"} />
                        )}
                      </View>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        {item.description ? <Text style={styles.rowSubtitle} numberOfLines={2}>{item.description}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          {!loading && (!cmsData?.subsections || cmsData.subsections.length === 0) && (
            <Text style={styles.emptyText}>Niciun conținut disponibil momentan.</Text>
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
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8ca8c4", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4, marginTop: 28 },
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
  badgeText: { fontSize: 16, fontWeight: "800" },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1a2d45", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#8ca8c4", lineHeight: 17 },
  loadingText: { textAlign: "center", color: "#8ca8c4", marginTop: 20, fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#8ca8c4", marginTop: 20, fontWeight: "600" },
  lockCard: {
    marginTop: 40, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
    padding: 28, alignItems: "center",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  lockTitle: { fontSize: 17, fontWeight: "700", color: "#1a2d45", marginTop: 14 },
  lockDesc: { fontSize: 14, color: "#6c8096", textAlign: "center", marginTop: 6, lineHeight: 20 },
  lockBtn: {
    marginTop: 18, backgroundColor: "#4a90e2", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  lockBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

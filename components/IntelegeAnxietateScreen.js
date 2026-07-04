import React, { useEffect } from "react";
import { Alert, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../contexts/SubscriptionContext";

const options = [
  {
    id: "anxietate",
    title: "Audio-uri despre anxietate",
    description: "Explicații și ghidaje pentru a înțelege anxietatea la nivel profund.",
    iconName: "headset-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    screen: "AudioAnxietateList",
  },
];

export default function IntelegeAnxietateScreen({ navigation }) {
  const { subscription } = useSubscription();
  const isTrial = String(subscription?.type || "").toLowerCase() === "trial";

  useEffect(() => {
    if (!isTrial) return;
    Alert.alert(
      "Funcție restricționată",
      "Înțelege anxietatea este disponibil doar cu un abonament activ.",
      [
        { text: "Vezi abonamente", onPress: () => navigation.replace("Subscriptions") },
        { text: "OK", onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Dashboard")), style: "cancel" },
      ]
    );
  }, [isTrial, navigation]);

  if (isTrial) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color="#24384e" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Înțelege anxietatea</Text>
          </View>

          <Text style={styles.sectionLabel}>CATEGORII</Text>

          <View style={styles.group}>
            {options.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    if (item.screen) {
                      navigation.navigate(item.screen);
                    } else {
                      navigation.navigate("IntelegeAnxietateVideo", {
                        title: item.title,
                        videoFile: item.video,
                        nowPlayingTitle: item.title,
                        nowPlayingArtist: "Dan fost anxios · Înțelege anxietatea",
                        nowPlayingAccent: item.iconColor,
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle}>{item.description}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9aa5b1" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1c2b3a", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#8a97a5", lineHeight: 17 },
});

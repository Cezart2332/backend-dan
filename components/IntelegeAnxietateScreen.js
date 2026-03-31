import React, { useEffect } from "react";
import { Alert, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../contexts/SubscriptionContext";

const options = [
  {
    id: "anxietate",
    title: "Audio-uri despre anxietate",
    description: "Explicații și ghidaje pentru a înțelege anxietatea la nivel profund.",
    iconName: "headset-outline",
    iconColor: "#8e44ad",
    iconBg: "#f5eeff",
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
        { text: "OK", onPress: () => navigation.goBack(), style: "cancel" },
      ]
    );
  }, [isTrial, navigation]);

  if (isTrial) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
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
                      navigation.navigate("IntelegeAnxietateVideo", { title: item.title, videoFile: item.video });
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
                  <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
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
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8ca8c4", letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 },
  group: {
    backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)", overflow: "hidden",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  separator: { height: 1, backgroundColor: "rgba(200,220,240,0.5)", marginLeft: 68 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1a2d45", marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: "#8ca8c4", lineHeight: 17 },
});

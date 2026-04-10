import React from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const DISCLAIMER_TEXT = `Medical Disclaimer:
This app provides general wellness and informational content only. It is not intended as medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare professional before making any medical decisions.`;

const SOURCES = [
  {
    id: "nhs",
    label: "NHS - Stress, anxiety and depression",
    url: "https://www.nhs.uk/conditions/stress-anxiety-depression/",
  },
  {
    id: "who",
    label: "WHO - Mental health: strengthening our response",
    url: "https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response",
  },
];

async function openSourceLink(url) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new Error("UNSUPPORTED_URL");
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Cannot open link", "Please open this source manually in your browser.");
  }
}

export default function MedicalInfoScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Medical Disclaimer</Text>
              <Text style={styles.subtitle}>Informational use only</Text>
            </View>
          </View>

          <View style={styles.disclaimerCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#2e6bb8" />
              </View>
              <Text style={styles.cardTitle}>Medical Disclaimer</Text>
            </View>
            <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
          </View>

          <View style={styles.referencesCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconWrap, styles.referencesIconWrap]}>
                <Ionicons name="library-outline" size={18} color="#2b7f5d" />
              </View>
              <Text style={styles.cardTitle}>Medical References</Text>
            </View>

            {SOURCES.map((source) => (
              <TouchableOpacity
                key={source.id}
                style={styles.sourceItem}
                onPress={() => openSourceLink(source.url)}
                activeOpacity={0.75}
              >
                <View style={styles.sourceTextWrap}>
                  <Text style={styles.sourceTitle}>{source.label}</Text>
                  <Text style={styles.sourceUrl}>{source.url}</Text>
                </View>
                <View style={styles.sourceActionWrap}>
                  <Text style={styles.sourceActionText}>View source</Text>
                  <Ionicons name="open-outline" size={15} color="#2e6bb8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.learnMoreButton}
            onPress={() => navigation.navigate("Terms")}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={18} color="#2e6bb8" style={{ marginRight: 8 }} />
            <Text style={styles.learnMoreText}>Learn more in Terms</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ddeeff",
  },
  background: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.15)",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a2d45",
  },
  subtitle: {
    fontSize: 13,
    color: "#6c8096",
    marginTop: 2,
  },
  disclaimerCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  referencesCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(90,165,133,0.25)",
    padding: 16,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(74,144,226,0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  referencesIconWrap: {
    backgroundColor: "rgba(76,174,76,0.14)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a2d45",
  },
  disclaimerText: {
    color: "#3e556b",
    fontSize: 14,
    lineHeight: 22,
  },
  sourceItem: {
    borderWidth: 1,
    borderColor: "rgba(200,220,240,0.8)",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    marginTop: 10,
  },
  sourceTextWrap: {
    marginBottom: 8,
  },
  sourceTitle: {
    color: "#1f344d",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  sourceUrl: {
    color: "#5f7891",
    fontSize: 12,
  },
  sourceActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,144,226,0.12)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceActionText: {
    color: "#2e6bb8",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 4,
  },
  learnMoreButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.76)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  learnMoreText: {
    color: "#2e6bb8",
    fontWeight: "700",
    fontSize: 13,
  },
});
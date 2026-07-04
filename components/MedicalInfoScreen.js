import React from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const DISCLAIMER_TEXT = `Informații medicale:
Această aplicație oferă conținut general de informare și sprijin pentru stare de bine. Nu înlocuiește sfatul, diagnosticul sau tratamentul medical. Cere întotdeauna părerea unui specialist calificat înainte de decizii medicale.`;

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
    Alert.alert("Nu pot deschide linkul", "Deschide sursa manual în browser.");
  }
}

export default function MedicalInfoScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Informații medicale</Text>
              <Text style={styles.subtitle}>Conținut informativ, nu sfat medical</Text>
            </View>
          </View>

          <View style={styles.disclaimerCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#16222f" />
              </View>
              <Text style={styles.cardTitle}>Informații medicale</Text>
            </View>
            <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
          </View>

          <View style={styles.referencesCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconWrap, styles.referencesIconWrap]}>
                <Ionicons name="library-outline" size={18} color="#2b7f5d" />
              </View>
              <Text style={styles.cardTitle}>Surse medicale</Text>
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
                  <Text style={styles.sourceActionText}>Vezi sursa</Text>
                  <Ionicons name="open-outline" size={15} color="#16222f" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.learnMoreButton}
            onPress={() => navigation.navigate("Terms")}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={18} color="#16222f" style={{ marginRight: 8 }} />
            <Text style={styles.learnMoreText}>Vezi mai multe în Termeni</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7f8",
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
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.18)",
    shadowColor: "#24384e",
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
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 22,
    fontWeight: "700",
    color: "#1c2b3a",
  },
  subtitle: {
    fontSize: 13,
    color: "#5b6a7a",
    marginTop: 2,
  },
  disclaimerCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(36,56,78,0.18)",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  referencesCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(61,125,95,0.25)",
    padding: 16,
    shadowColor: "#24384e",
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
    backgroundColor: "rgba(36,56,78,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  referencesIconWrap: {
    backgroundColor: "rgba(61,125,95,0.14)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1c2b3a",
  },
  disclaimerText: {
    color: "#3e556b",
    fontSize: 14,
    lineHeight: 22,
  },
  sourceItem: {
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.22)",
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
    backgroundColor: "rgba(36,56,78,0.1)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceActionText: {
    color: "#16222f",
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
    borderColor: "rgba(36,56,78,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  learnMoreText: {
    color: "#16222f",
    fontWeight: "700",
    fontSize: 13,
  },
});

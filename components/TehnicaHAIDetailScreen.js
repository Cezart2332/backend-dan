import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

export default function TehnicaHAIDetailScreen({ navigation, route }) {
  const { title, description, note } = route.params || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]}
        style={styles.background}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{title || "Tehnica HAI"}</Text>
          {description ? (
            <Text style={styles.paragraph}>{description}</Text>
          ) : null}
          {note ? (
            <Text style={[styles.paragraph, styles.note]}>{note}</Text>
          ) : null}
          {!description && !note ? (
            <Text style={styles.paragraph}>
              Conținutul pentru această secțiune va fi disponibil în curând.
              Între timp, te încurajez să îți rezervi câteva minute pentru a
              trece prin pașii principali ai tehnicii HAI și să îi aplici în
              situațiile tale zilnice.
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
          >
            <Ionicons name="chevron-back" size={20} color="#24384e" />
            <Text style={styles.backText}>Înapoi</Text>
          </TouchableOpacity>
        </ScrollView>
        <HeadphonesDisclaimer visibleInitially={false} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  background: { flex: 1 },
  content: { padding: 20 },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 22,
    fontWeight: "700",
    color: "#1c2b3a",
    textAlign: "center",
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: "#1c2b3a",
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "center",
  },
  note: {
    fontStyle: "italic",
    color: "#24384e",
  },
  backBtn: {
    flexDirection: 'row',
    alignSelf: "center",
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    alignItems: 'center',
  },
  backText: { color: "#24384e", fontWeight: "600", marginLeft: 2 },
});

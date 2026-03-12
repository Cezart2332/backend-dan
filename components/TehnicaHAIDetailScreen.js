import React from "react";
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

export default function TehnicaHAIDetailScreen({ navigation, route }) {
  const { title, description, note } = route.params || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]}
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
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color="#4a90e2" />
            <Text style={styles.backText}>Înapoi</Text>
          </TouchableOpacity>
        </ScrollView>
        <HeadphonesDisclaimer visibleInitially={false} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  background: { flex: 1 },
  content: { padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a2d45",
    textAlign: "center",
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: "#1a2d45",
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "center",
  },
  note: {
    fontStyle: "italic",
    color: "#4a90e2",
  },
  backBtn: {
    flexDirection: 'row',
    alignSelf: "center",
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    alignItems: 'center',
  },
  backText: { color: "#4a90e2", fontWeight: "600", marginLeft: 2 },
});

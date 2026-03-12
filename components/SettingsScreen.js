import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Keyboard,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../utils/api";
import { getToken, removeToken } from "../utils/authStorage";
import { removeUser } from "../utils/userStorage";
import { removeSubscription } from "../utils/subscriptionStorage";

export default function SettingsScreen({ navigation, onLogout }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugEmail, setBugEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "STERGE") {
      Alert.alert("Eroare", "Scrie 'STERGE' pentru a confirma ștergerea contului.");
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        Alert.alert("Eroare", "Nu ești autentificat.");
        return;
      }

      const response = await api.deleteAccount(token);
      
      if (response.success) {
        // Clear all local storage
        await removeToken();
        await removeUser();
        await removeSubscription();
        
        Alert.alert(
          "Cont șters",
          "Contul tău a fost șters cu succes.",
          [
            {
              text: "OK",
              onPress: () => {
                if (typeof onLogout === "function") {
                  onLogout();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("Eroare", response.error || "Nu s-a putut șterge contul.");
      }
    } catch (error) {
      Alert.alert("Eroare", error.message || "A apărut o eroare la ștergerea contului.");
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
    }
  };

  const handleReportBug = async () => {
    if (!bugDescription.trim()) {
      Alert.alert("Eroare", "Te rog descrie problema întâlnită.");
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      
      const response = await api.reportBug({
        description: bugDescription,
        contactEmail: bugEmail || undefined,
      }, token);
      
      if (response.success) {
        Alert.alert(
          "Mulțumim!",
          "Raportul tău a fost trimis. Vom analiza problema cât mai curând.",
          [{ text: "OK" }]
        );
        setShowBugModal(false);
        setBugDescription("");
        setBugEmail("");
      } else {
        Alert.alert("Eroare", response.error || "Nu s-a putut trimite raportul.");
      }
    } catch (error) {
      Alert.alert("Eroare", error.message || "A apărut o eroare la trimiterea raportului.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]}
        style={styles.background}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Setări</Text>
          </View>

          {/* Section: Suport */}
          <Text style={styles.sectionLabel}>SUPORT</Text>
          <View style={styles.group}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowBugModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#fff7e6" }]}>
                <Ionicons name="bug-outline" size={20} color="#f0a500" />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Raportează un bug</Text>
                <Text style={styles.rowSubtitle}>Ajută-ne să îmbunătățim aplicația</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#c8d8e8" />
            </TouchableOpacity>
          </View>

          {/* Section: Cont */}
          <Text style={styles.sectionLabel}>CONT</Text>
          <View style={styles.group}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowDeleteModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#fff0f0" }]}>
                <Ionicons name="trash-outline" size={20} color="#d9534f" />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowTitle, { color: "#d9534f" }]}>Șterge contul</Text>
                <Text style={styles.rowSubtitle}>Această acțiune este permanentă</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#e8c8c8" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetIconRow}>
              <View style={[styles.sheetIconWrap, { backgroundColor: "#fff0f0" }]}>
                <Ionicons name="trash-outline" size={26} color="#d9534f" />
              </View>
            </View>
            <Text style={styles.sheetTitle}>Șterge contul</Text>
            <Text style={styles.sheetBody}>
              Această acțiune este permanentă și nu poate fi anulată. Toate
              datele tale, inclusiv progresul și abonamentul, vor fi șterse.
            </Text>
            <Text style={styles.sheetBody}>
              Scrie{" "}
              <Text style={styles.confirmWord}>STERGE</Text>
              {" "}pentru a confirma:
            </Text>
            <TextInput
              style={styles.input}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="STERGE"
              placeholderTextColor="#c0c8d0"
              autoCapitalize="characters"
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelBtnText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.destructiveBtn,
                  (loading || deleteConfirmText !== "STERGE") && styles.btnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={loading || deleteConfirmText !== "STERGE"}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.destructiveBtnText}>Șterge contul</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bug Report Modal */}
      <Modal
        visible={showBugModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBugModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetIconRow}>
              <View style={[styles.sheetIconWrap, { backgroundColor: "#fff7e6" }]}>
                <Ionicons name="bug-outline" size={26} color="#f0a500" />
              </View>
            </View>
            <Text style={styles.sheetTitle}>Raportează un bug</Text>
            <Text style={styles.sheetBody}>
              Descrie problema întâlnită cât mai specific posibil.
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bugDescription}
              onChangeText={setBugDescription}
              placeholder="Descrie problema..."
              placeholderTextColor="#c0c8d0"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              value={bugEmail}
              onChangeText={setBugEmail}
              placeholder="Email de contact (opțional)"
              placeholderTextColor="#c0c8d0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowBugModal(false);
                  setBugDescription("");
                  setBugEmail("");
                }}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelBtnText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (loading || !bugDescription.trim()) && styles.btnDisabled,
                ]}
                onPress={handleReportBug}
                disabled={loading || !bugDescription.trim()}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Trimite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    marginTop: 4,
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
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a2d45",
    letterSpacing: -0.4,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8ca8c4",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Grouped rows
  group: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(200,220,240,0.6)",
    overflow: "hidden",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 28,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a2d45",
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#8ca8c4",
    fontWeight: "400",
  },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 30, 60, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  // Modal sheet
  sheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(245,250,255,0.97)",
    borderRadius: 26,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(200,220,242,0.6)",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetIconRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  sheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a2d45",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sheetBody: {
    fontSize: 14,
    color: "#6c8096",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmWord: {
    fontWeight: "700",
    color: "#d9534f",
    letterSpacing: 0.5,
  },

  // Input
  input: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1a2d45",
    borderWidth: 1,
    borderColor: "rgba(200,220,240,0.8)",
    marginBottom: 12,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 13,
  },

  // Action buttons
  sheetActions: {
    flexDirection: "row",
    marginTop: 8,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(200,215,230,0.35)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(200,215,230,0.5)",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5a7a95",
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#d9534f",
    alignItems: "center",
    shadowColor: "#d9534f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  destructiveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#4a90e2",
    alignItems: "center",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
});

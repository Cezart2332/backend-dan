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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Setări</Text>
          </View>

          {/* Report Bug Button */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setShowBugModal(true)}
          >
            <LinearGradient
              colors={["#ffffff", "#f8fdff"]}
              style={styles.optionCardInner}
            >
              <Text style={styles.optionIcon}>🐛</Text>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Raportează un bug</Text>
                <Text style={styles.optionSubtitle}>
                  Ajută-ne să îmbunătățim aplicația
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[styles.optionCard, styles.dangerCard]}
            onPress={() => setShowDeleteModal(true)}
          >
            <LinearGradient
              colors={["#ffffff", "#fff5f5"]}
              style={styles.optionCardInner}
            >
              <Text style={styles.optionIcon}>🗑️</Text>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.dangerText]}>
                  Șterge acest cont
                </Text>
                <Text style={styles.optionSubtitle}>
                  Această acțiune este permanentă
                </Text>
              </View>
              <Text style={[styles.optionArrow, styles.dangerText]}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Șterge contul</Text>
            <Text style={styles.modalText}>
              Această acțiune este permanentă și nu poate fi anulată. Toate
              datele tale, inclusiv progresul și abonamentul, vor fi șterse.
            </Text>
            <Text style={styles.modalText}>
              Pentru a confirma, scrie{" "}
              <Text style={styles.boldText}>STERGE</Text> mai jos:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Scrie STERGE pentru a confirma"
              placeholderTextColor="#a0a0a0"
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={loading}
              >
                <Text style={styles.modalCancelText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  deleteConfirmText !== "STERGE" && styles.modalBtnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={loading || deleteConfirmText !== "STERGE"}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Șterge contul</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🐛 Raportează un bug</Text>
            <Text style={styles.modalText}>
              Descrie problema pe care ai întâlnit-o. Încearcă să fii cât mai
              specific posibil.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              value={bugDescription}
              onChangeText={setBugDescription}
              placeholder="Descrie problema..."
              placeholderTextColor="#a0a0a0"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.modalInput}
              value={bugEmail}
              onChangeText={setBugEmail}
              placeholder="Email de contact (opțional)"
              placeholderTextColor="#a0a0a0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowBugModal(false);
                  setBugDescription("");
                  setBugEmail("");
                }}
                disabled={loading}
              >
                <Text style={styles.modalCancelText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  !bugDescription.trim() && styles.modalBtnDisabled,
                ]}
                onPress={handleReportBug}
                disabled={loading || !bugDescription.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Trimite</Text>
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
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: {
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: -2,
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    elevation: 3,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backIcon: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
  },
  optionCard: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dangerCard: {
    borderColor: "#ffdddd",
  },
  optionCardInner: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: { fontSize: 24, marginRight: 12 },
  optionTextContainer: { flex: 1 },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: "#6c7b84",
  },
  optionArrow: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
  dangerText: { color: "#d9534f" },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 16,
  },
  modalText: {
    fontSize: 14,
    color: "#6c7b84",
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  boldText: {
    fontWeight: "700",
    color: "#d9534f",
  },
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#2c3e50",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6c7b84",
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: "#d9534f",
    alignItems: "center",
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: "#4a90e2",
    alignItems: "center",
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
});

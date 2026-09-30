import React, { useCallback, useEffect, useState } from "react";
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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { api } from "../utils/api";
import { getToken } from "../utils/authStorage";
import { signOutCleanup } from "../utils/session";
import { hapticNotify, hapticSelection } from "../utils/haptics";
import { useTheme, useThemedStyles } from "./ui/themeContext";
import { AppButton } from './ui';
import { getUser } from '../utils/userStorage';
import { wellbeingRepository, stopWellbeingAccount } from '../utils/wellbeingRuntime';
import { removePanelActivity } from '../utils/panelActivity';
import { deleteAudioActivity } from '../utils/audioActivity';

const THEME_OPTIONS = [
  { value: "system", label: "Sistem", icon: "smartphone" },
  { value: "light", label: "Luminos", icon: "sun" },
  { value: "dark", label: "Întunecat", icon: "moon" },
];

export default function SettingsScreen({ navigation, onLogout }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { preference, setPreference } = useTheme();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugEmail, setBugEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatPush, setChatPush] = useState(null);
  const [savingChatPush, setSavingChatPush] = useState(false);

  useEffect(() => {
    let mounted = true;
    getToken()
      .then((token) => (token ? api.getNotificationPreferences(token) : null))
      .then((prefs) => {
        if (mounted && prefs) setChatPush(prefs.chatPush !== false);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleChatPush = useCallback(async (value) => {
    const previous = chatPush;
    setChatPush(value);
    setSavingChatPush(true);
    hapticSelection();

    try {
      const token = await getToken();
      if (!token) throw new Error("Nu ești autentificat.");
      await api.updateNotificationPreferences({ chatPush: value }, token);
    } catch (error) {
      setChatPush(previous);
      Alert.alert("Eroare", error?.message || "Nu am putut salva preferința.");
    } finally {
      setSavingChatPush(false);
    }
  }, [chatPush]);

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
        const user = await getUser();
        await stopWellbeingAccount();
        if (user?.id) await wellbeingRepository.remove(String(user.id));
        if (user?.id) await deleteAudioActivity(user.id);
        if (user?.id) await removePanelActivity(user.id);
        // Clear all local storage
        await signOutCleanup();
        hapticNotify("success");

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
                navigation.reset({ index: 0, routes: [{ name: "Login" }] });
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
        hapticNotify("success");
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
        colors={[tc("#f6f7f8", 'bg'), tc("#f3f4f6", 'bg'), tc("#eef0f2", 'bg')]}
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi"
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
              style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.75}
            >
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Setări</Text>
          </View>

          {/* Section: Notificări */}
          <AppButton title="Setări SOS și reminder check-in" variant="ghost" onPress={() => navigation.navigate('WellbeingSettings')} />
          <Text style={styles.sectionLabel}>NOTIFICĂRI</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: tc("#e9f0ec", 'bg') }]}>
                <Feather name="message-square" size={20} color={tc("#3d7d5f", 'fg')} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Mesaje din comunitate</Text>
                <Text style={styles.rowSubtitle}>O notificare pentru fiecare mesaj nou din chat</Text>
              </View>
              <Switch
                value={chatPush === true}
                onValueChange={handleToggleChatPush}
                disabled={chatPush === null || savingChatPush}
                trackColor={{ false: tc("rgba(32,47,62,0.18)", 'bg'), true: tc("#3d7d5f", 'bg') }}
                ios_backgroundColor={tc("rgba(32,47,62,0.18)", 'bg')}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Section: Aspect */}
          <Text style={styles.sectionLabel}>ASPECT</Text>
          <View style={styles.group}>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((option) => {
                const active = preference === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.themeOption, active && styles.themeOptionActive]}
                    onPress={() => {
                      hapticSelection();
                      setPreference(option.value);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Feather name={option.icon} size={18} color={active ? tc("#1c2b3a", 'fg') : tc("#8a97a5", 'fg')} />
                    <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section: Siguranță medicală */}
          <Text style={styles.sectionLabel}>SIGURANȚĂ MEDICALĂ</Text>
          <View style={styles.group}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate("MedicalInfo")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: tc("#eef5ff", 'bg') }]}>
                <Feather name="activity" size={20} color={tc("#16222f", 'fg')} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Informații medicale și surse</Text>
                <Text style={styles.rowSubtitle}>Conținut informativ. Vezi sursele rapid.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tc("#9aa5b1", 'fg')} />
            </TouchableOpacity>
          </View>

          {/* Section: Suport */}
          <Text style={styles.sectionLabel}>SUPORT</Text>
          <View style={styles.group}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowBugModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: tc("#f7f2e7", 'bg') }]}>
                <Ionicons name="bug-outline" size={20} color={tc("#b3924f", 'fg')} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Raportează un bug</Text>
                <Text style={styles.rowSubtitle}>Ajută-ne să îmbunătățim aplicația</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tc("#9aa5b1", 'fg')} />
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
              <View style={[styles.iconWrap, { backgroundColor: tc("#f6ecea", 'bg') }]}>
                <Feather name="trash-2" size={20} color={tc("#a8544c", 'fg')} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowTitle, { color: tc("#a8544c", 'fg') }]}>Șterge contul</Text>
                <Text style={styles.rowSubtitle}>Această acțiune este permanentă</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tc("#e8c8c8", 'fg')} />
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
              <View style={[styles.sheetIconWrap, { backgroundColor: tc("#f6ecea", 'bg') }]}>
                <Feather name="trash-2" size={26} color={tc("#a8544c", 'fg')} />
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
              placeholderTextColor={tc("#c3cad2", 'fg')}
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
                  <ActivityIndicator color={tc("#fff", 'fg')} size="small" />
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
              <View style={[styles.sheetIconWrap, { backgroundColor: tc("#f7f2e7", 'bg') }]}>
                <Ionicons name="bug-outline" size={26} color={tc("#b3924f", 'fg')} />
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
              placeholderTextColor={tc("#c3cad2", 'fg')}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              value={bugEmail}
              onChangeText={setBugEmail}
              placeholder="Email de contact (opțional)"
              placeholderTextColor={tc("#c3cad2", 'fg')}
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
                  <ActivityIndicator color={tc("#fff", 'fg')} size="small" />
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

const createStyles = (tc) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tc("#f6f7f8", 'bg'),
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
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: tc("#1c2b3a", 'fg'),
    letterSpacing: -0.4,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: tc("#8a97a5", 'fg'),
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Grouped rows
  group: {
    backgroundColor: tc("rgba(255,255,255,0.58)", 'bg'),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
    overflow: "hidden",
    shadowColor: "#24384e",
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
    color: tc("#1c2b3a", 'fg'),
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: tc("#8a97a5", 'fg'),
    fontWeight: "400",
  },

  // Theme picker
  themeRow: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  themeOptionActive: {
    backgroundColor: tc("rgba(255,255,255,0.85)", 'bg'),
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
  },
  themeOptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: tc("#8a97a5", 'fg'),
  },
  themeOptionTextActive: {
    color: tc("#1c2b3a", 'fg'),
  },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: tc("rgba(10, 30, 60, 0.45)", 'bg'),
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  // Modal sheet
  sheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: tc("rgba(246,247,248,0.97)", 'bg'),
    borderRadius: 26,
    padding: 28,
    borderWidth: 1,
    borderColor: tc("rgba(200,220,242,0.6)", 'bg'),
    shadowColor: "#24384e",
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
    color: tc("#1c2b3a", 'fg'),
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sheetBody: {
    fontSize: 14,
    color: tc("#5b6a7a", 'fg'),
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmWord: {
    fontWeight: "700",
    color: tc("#a8544c", 'fg'),
    letterSpacing: 0.5,
  },

  // Input
  input: {
    backgroundColor: tc("rgba(255,255,255,0.68)", 'bg'),
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: tc("#1c2b3a", 'fg'),
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.22)", 'bg'),
    marginBottom: 12,
    shadowColor: "#24384e",
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
    backgroundColor: tc("rgba(201,208,215,0.35)", 'bg'),
    alignItems: "center",
    borderWidth: 1,
    borderColor: tc("rgba(201,208,215,0.5)", 'bg'),
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: tc("#5a7a95", 'fg'),
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tc("#a8544c", 'bg'),
    alignItems: "center",
    shadowColor: "#a8544c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  destructiveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: tc("#fff", 'fg'),
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tc("#24384e", 'bg'),
    alignItems: "center",
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: tc("#fff", 'fg'),
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
});

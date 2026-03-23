import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../contexts/SubscriptionContext";

const { width } = Dimensions.get("window");
const EXCLUDED_ROUTES = new Set(["Login", "Register", "Subscriptions", "Onboarding"]);

export default function SubscriptionPaywall({ isAuthed, navigationRef, currentRoute }) {
  const { status, trialEligible, refresh, initializing, hasToken, showPaywall, restorePurchases, startFreeTrial } = useSubscription();
  const [pendingAction, setPendingAction] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const shouldShow = useMemo(() => {
    if (!isAuthed) return false;
    if (!hasToken) return false;
    if (initializing) return false;
    if (!status || status === "active") return false;
    if (currentRoute && EXCLUDED_ROUTES.has(currentRoute)) return false;
    return true;
  }, [isAuthed, hasToken, initializing, status, currentRoute]);

  useEffect(() => {
    if (shouldShow) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 90,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldShow, scaleAnim]);

  const handleSeePlans = () => {
    if (!navigationRef?.current) return;
    const currentName = navigationRef.current.getCurrentRoute?.()?.name;
    if (currentName !== "Subscriptions") {
      navigationRef.current.navigate("Subscriptions");
    }
  };

  const handleOpenPaywall = async () => {
    try {
      setPendingAction("paywall");
      await showPaywall();
      await refresh();
    } catch (err) {
      const msg = err?.message || "Nu am putut deschide paywall-ul.";
      Alert.alert("Eroare", msg);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestore = async () => {
    try {
      setPendingAction("restore");
      await restorePurchases();
      await refresh();
      Alert.alert("Restore", "Achizitiile au fost restaurate.");
    } catch (err) {
      Alert.alert("Eroare", err?.message || "Nu am putut restaura achizitiile.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartTrial = async () => {
    try {
      setPendingAction("trial");
      await startFreeTrial();
      await refresh();
      Alert.alert("Trial activat", "Ai 3 zile de trial gratuit.");
    } catch (err) {
      Alert.alert("Eroare", err?.message || "Nu am putut porni trial-ul gratuit.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setPendingAction("refresh");
      await refresh();
    } finally {
      setPendingAction(null);
    }
  };

  if (!shouldShow) {
    return null;
  }

  const contentScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const contentOpacity = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal
      visible={shouldShow}
      transparent
      animationType="fade"
      onRequestClose={handleSeePlans}
    >
      <View style={styles.backdrop} pointerEvents="auto">
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: contentScale }],
              opacity: contentOpacity,
            },
          ]}
        >
          <View style={styles.gradient}>
            <View style={styles.headerIcon}>
              <Ionicons name="star-outline" size={32} color="#4a90e2" />
            </View>
            <Text style={styles.title}>Subscribe sau Free Trial</Text>
            <Text style={styles.subtitle}>
              Activeaza un abonament pentru a continua accesul complet in aplicatie.
            </Text>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {status === "expired" ? "Abonament expirat" : "Fără abonament activ"}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, pendingAction && styles.disabledButton]}
              onPress={handleOpenPaywall}
              disabled={pendingAction === "paywall"}
            >
              <View style={styles.primaryGradient}>
                {pendingAction === "paywall" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Deschide paywall</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Planurile disponibile sunt Monthly, Yearly si Lifetime.
              </Text>
            </View>

            {trialEligible ? (
              <TouchableOpacity
                style={[styles.secondaryButton, pendingAction && styles.disabledButton]}
                onPress={handleStartTrial}
                disabled={pendingAction === "trial"}
              >
                {pendingAction === "trial" ? (
                  <ActivityIndicator color="#4a90e2" />
                ) : (
                  <Text style={styles.secondaryText}>Porneste trial gratuit (3 zile)</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSeePlans}
              disabled={Boolean(pendingAction)}
            >
              <Text style={styles.secondaryText}>Vezi ecranul de abonamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRestore}
              disabled={pendingAction === "restore"}
            >
              {pendingAction === "restore" ? (
                <ActivityIndicator color="#4a90e2" />
              ) : (
                <Text style={styles.refreshText}>Restore purchases</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? (
                <ActivityIndicator color="#4a90e2" />
              ) : (
                <Text style={styles.refreshText}>Refresh customer info</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 24, 44, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(width - 32, 360),
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 18,
  },
  gradient: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "rgba(241,247,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(200,220,240,0.6)",
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(74,144,226,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a2d45",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6c8096",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  statusPill: {
    backgroundColor: "rgba(74,144,226,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
  },
  statusText: {
    color: "#1a2d45",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  primaryGradient: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#4a90e2",
    borderRadius: 16,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(74,144,226,0.3)",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  secondaryText: {
    color: "#1a2d45",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "rgba(74,144,226,0.08)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.15)",
  },
  infoText: {
    color: "#1a2d45",
    fontSize: 13,
    textAlign: "center",
  },
  refreshButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
  refreshText: {
    color: "#6c8096",
    fontSize: 13,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  disabledButton: {
    opacity: 0.7,
  },
});

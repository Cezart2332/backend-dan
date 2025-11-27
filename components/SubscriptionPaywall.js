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
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "../contexts/SubscriptionContext";
import { api } from "../utils/api";
import { getToken } from "../utils/authStorage";

const { width } = Dimensions.get("window");
const EXCLUDED_ROUTES = new Set(["Login", "Register", "Subscriptions", "Onboarding"]);

export default function SubscriptionPaywall({ isAuthed, navigationRef, currentRoute }) {
  const { status, trialEligible, refresh, initializing, hasToken } = useSubscription();
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

  const handleStartTrial = async () => {
    if (!trialEligible) return;
    try {
      setPendingAction("trial");
      const token = await getToken();
      if (!token) {
        Alert.alert("Autentificare", "Trebuie să te autentifici din nou.");
        return;
      }
      await api.startTrial(token);
      await refresh();
      Alert.alert("Trial activ", "Ai acces la 3 zile de conținut complet.");
    } catch (err) {
      const msg = err?.message || "Nu am putut activa perioada de trial.";
      Alert.alert("Eroare", msg);
      if (msg.includes("Trial deja folosit") || msg.includes("TRIAL_ALREADY_USED")) {
        await refresh();
      }
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
          <LinearGradient
            colors={["#ffecd2", "#fcb69f", "#f6d365"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.headerIcon}>
              <Text style={styles.iconText}>✨</Text>
            </View>
            <Text style={styles.title}>Subscribe sau Free Trial</Text>
            <Text style={styles.subtitle}>
              Activează abonamentul sau perioada de trial ca să continui să folosești aplicația.
            </Text>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {status === "expired" ? "Abonament expirat" : "Fără abonament activ"}
              </Text>
            </View>

            {trialEligible ? (
              <TouchableOpacity
                style={[styles.primaryButton, pendingAction && styles.disabledButton]}
                onPress={handleStartTrial}
                disabled={pendingAction === "trial"}
              >
                <LinearGradient
                  colors={["#4a90e2", "#577fff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  {pendingAction === "trial" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Începe perioada de trial</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Perioada de trial a fost folosită. Alege un abonament pentru acces complet.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSeePlans}
              disabled={pendingAction === "trial"}
            >
              <Text style={styles.secondaryText}>Vezi abonamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? (
                <ActivityIndicator color="#4a90e2" />
              ) : (
                <Text style={styles.refreshText}>Am deja abonament activ</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 24, 44, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(width - 32, 360),
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 18,
  },
  gradient: {
    padding: 24,
    alignItems: "center",
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#102349",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#284064",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  statusPill: {
    backgroundColor: "rgba(16, 35, 73, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 22,
  },
  statusText: {
    color: "#102349",
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
    borderColor: "rgba(16, 35, 73, 0.3)",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  secondaryText: {
    color: "#102349",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "rgba(16,35,73,0.12)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  infoText: {
    color: "#102349",
    fontSize: 13,
    textAlign: "center",
  },
  refreshButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
  refreshText: {
    color: "#102349",
    fontSize: 13,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  disabledButton: {
    opacity: 0.7,
  },
});

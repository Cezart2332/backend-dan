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
  Platform,
} from 'react-native';
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../contexts/SubscriptionContext";
import { signOutCleanup } from "../utils/session";
import { subscriptionLoadingVisible } from '../utils/subscriptionPolicy.mjs';
import { useTheme, useThemedStyles } from "./ui/themeContext";

const { width } = Dimensions.get("window");
const EXCLUDED_ROUTES = new Set(["Login", "Register", "Subscriptions", "Onboarding", "Profile"]);

export default function SubscriptionPaywall({ isAuthed, navigationRef, currentRoute, onLogout }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    subscription,
    status,
    hasProEntitlement,
    trialEligible,
    refresh,
    initializing,
    subscriptionResolved,
    hasToken,
    showPaywall,
    restorePermissions,
    startFreeTrial,
    paywallRequested,
    dismissPaywall,
  } = useSubscription();
  const [pendingAction, setPendingAction] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const shouldShowLoading = subscriptionLoadingVisible({ isAuthed, paywallRequested, initializing, subscriptionResolved, pendingAction });

  // Paywall-ul nu se mai afiseaza automat pentru utilizatorii fara abonament.
  // Apare doar la cerere (paywallRequested), cand utilizatorul apasa pe o sectiune blocata.
  const shouldShow = useMemo(() => {
    const isTrialSubscription = String(subscription?.type || "").toLowerCase() === "trial";
    const trialEndsAtMs = subscription?.ends_at ? Date.parse(subscription.ends_at) : NaN;
    const hasActiveTrialAccess =
      isTrialSubscription && (!Number.isFinite(trialEndsAtMs) || trialEndsAtMs > Date.now());

    if (!paywallRequested) return false;
    if (!isAuthed) return false;
    if (!hasToken) return false;
    if (initializing) return false;
    if (hasActiveTrialAccess) return false;
    if (hasProEntitlement) return false;
    if (currentRoute && EXCLUDED_ROUTES.has(currentRoute)) return false;
    return true;
  }, [paywallRequested, isAuthed, hasToken, initializing, subscription, hasProEntitlement, currentRoute]);

  // Dupa o achizitie reusita nu mai are sens sa ramana cererea de paywall activa.
  useEffect(() => {
    if (paywallRequested && hasProEntitlement) {
      dismissPaywall();
    }
  }, [paywallRequested, hasProEntitlement, dismissPaywall]);

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

  const handleClose = () => {
    dismissPaywall();
  };

  const handleSeePlans = () => {
    dismissPaywall();
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
    } catch (err) {
      const msg = err?.message || "Nu am putut deschide paywall-ul.";
      Alert.alert("Eroare", msg);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestaurare = async () => {
    try {
      setPendingAction("restore");
      await restorePermissions();
      await refresh();
      Alert.alert("Restaurare", "Achizițiile au fost restaurate.");
    } catch (err) {
      Alert.alert("Eroare", err?.message || "Nu am putut restaura achizițiile.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartTrial = async () => {
    try {
      setPendingAction("trial");
      await startFreeTrial();
      dismissPaywall();
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
    } catch (err) {
      Alert.alert("Abonament", err?.message || "Nu am putut actualiza abonamentul.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleLogout = async () => {
    try {
      setPendingAction("logout");
      await signOutCleanup();
    } finally {
      setPendingAction(null);
      dismissPaywall();
      if (typeof onLogout === "function") onLogout();
      if (navigationRef?.current?.reset) {
        navigationRef.current.reset({ index: 0, routes: [{ name: "Login" }] });
      } else if (navigationRef?.current?.navigate) {
        navigationRef.current.navigate("Login");
      }
    }
  };

  if (shouldShowLoading) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={tc("#24384e", 'fg')} />
            <Text style={styles.loadingTitle}>Verificăm abonamentul</Text>
            <Text style={styles.loadingSubtitle}>Sincronizăm statusul din RevenueCat</Text>
          </View>
        </View>
      </Modal>
    );
  }

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
      onRequestClose={handleClose}
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Închide"
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color={tc("#5b6a7a", 'fg')} />
            </TouchableOpacity>
            <View style={styles.headerIcon}>
              <Feather name="star" size={32} color={tc("#24384e", 'fg')} />
            </View>
            <Text style={styles.title}>Conținut cu abonament</Text>
            <Text style={styles.subtitle}>
              Secțiunea aleasă face parte din conținutul premium. Activează un abonament sau trialul gratuit pentru acces complet.
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
                  <ActivityIndicator color={tc("#fff", 'fg')} />
                ) : (
                  <Text style={styles.primaryText}>Vezi opțiunile</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Planurile disponibile sunt lunar, anual și pe viață.
              </Text>
            </View>

            {trialEligible || status === "none" || status === "expired" ? (
              <TouchableOpacity
                style={[styles.secondaryButton, pendingAction && styles.disabledButton]}
                onPress={handleStartTrial}
                disabled={pendingAction === "trial"}
              >
                {pendingAction === "trial" ? (
                  <ActivityIndicator color={tc("#24384e", 'fg')} />
                ) : (
                  <Text style={styles.secondaryText}>
                    {trialEligible
                      ? "Pornește trial gratuit (3 zile)"
                      : "Pornește trial gratuit (verificăm eligibilitatea)"}
                  </Text>
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
              style={[styles.logoutButton, pendingAction && styles.disabledButton]}
              onPress={handleLogout}
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === "logout" ? (
                <ActivityIndicator color={tc("#a8544c", 'fg')} />
              ) : (
                <Text style={styles.logoutText}>Schimbă contul</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRestaurare}
              disabled={pendingAction === "restore"}
            >
              {pendingAction === "restore" ? (
                <ActivityIndicator color={tc("#24384e", 'fg')} />
              ) : (
                <Text style={styles.refreshText}>Restaurează achizițiile</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? (
                <ActivityIndicator color={tc("#24384e", 'fg')} />
              ) : (
                <Text style={styles.refreshText}>Reverifică abonamentul</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (tc) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tc("rgba(16, 25, 35, 0.65)", 'bg'),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(width - 32, 360),
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 18,
  },
  gradient: {
    padding: 24,
    alignItems: "center",
    backgroundColor: tc("rgba(246,247,248,0.9)", 'bg'),
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(36,56,78,0.08)", 'bg'),
    zIndex: 10,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tc("rgba(36,56,78,0.1)", 'bg'),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 22,
    fontWeight: "700",
    color: tc("#1c2b3a", 'fg'),
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: tc("#5b6a7a", 'fg'),
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  statusPill: {
    backgroundColor: tc("rgba(36,56,78,0.1)", 'bg'),
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: tc("rgba(36,56,78,0.18)", 'bg'),
  },
  statusText: {
    color: tc("#1c2b3a", 'fg'),
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 14,
  },
  primaryGradient: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: tc("rgba(28,43,58,0.92)", 'bg'),
    borderRadius: 999,
  },
  primaryText: {
    color: tc("#ffffff", 'fg'),
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  secondaryButton: {
    width: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tc("rgba(36,56,78,0.24)", 'bg'),
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: tc("rgba(255,255,255,0.65)", 'bg'),
  },
  secondaryText: {
    color: tc("#1c2b3a", 'fg'),
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    width: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tc("rgba(168, 84, 76, 0.35)", 'bg'),
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: tc("rgba(255, 237, 237, 0.8)", 'bg'),
  },
  logoutText: {
    color: tc("#a8544c", 'fg'),
    fontSize: 15,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: tc("rgba(36,56,78,0.08)", 'bg'),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
  },
  infoText: {
    color: tc("#1c2b3a", 'fg'),
    fontSize: 13,
    textAlign: "center",
  },
  refreshButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
  refreshText: {
    color: tc("#5b6a7a", 'fg'),
    fontSize: 13,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingCard: {
    width: Math.min(width - 64, 320),
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: tc("rgba(246,247,248,0.98)", 'bg'),
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.18)", 'bg'),
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "700",
    color: tc("#1c2b3a", 'fg'),
    textAlign: "center",
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: tc("#5b6a7a", 'fg'),
    textAlign: "center",
  },
});

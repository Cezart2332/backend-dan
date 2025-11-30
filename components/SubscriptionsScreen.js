import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  Linking,
  AppState,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { api } from "../utils/api";
import { getToken } from "../utils/authStorage";
import { useSubscription } from "../contexts/SubscriptionContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

export default function SubscriptionsScreen({ navigation }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [useInAppCheckout, setUseInAppCheckout] = useState(true); // toggle between hosted checkout vs in-app PaymentSheet
  // Billing cycle: 'monthly' | 'annual'
  const [billingCycle, setBillingCycle] = useState("monthly"); // only monthly plans available
  const [selectedPlan, setSelectedPlan] = useState(null); // basic | premium | vip
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const {
    subscription: contextSubscription,
    status,
    trialEligible,
    refresh: refreshSubscription,
  } = useSubscription();
  const currentSub = contextSubscription;
  const trialUsed = !trialEligible;

  // Animations for plan cards (staggered)
  const animValues = useRef(
    ["basic", "premium", "vip"].map(() => new Animated.Value(0))
  ).current;
  useEffect(() => {
    Animated.stagger(
      130,
      animValues.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const loadSubscription = useCallback(async () => {
    try {
      await refreshSubscription();
    } catch (e) {
      // Subscription load failed silently
    }
  }, [refreshSubscription]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (!currentSub?.ends_at) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [currentSub?.ends_at]);

  // Auto refresh when returning to foreground (e.g. after external Checkout)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadSubscription();
      }
    });
    return () => {
      sub.remove();
    };
  }, [loadSubscription]);

  const monthlyPlans = [
    {
      key: "basic",
      title: "Plan Basic",
      price: "29 lei/lună",
      subPrice: "9 lei/săptămână (≈ 1 leu/zi)",
      tagline:
        "„Doar ~1 leu pe zi pentru liniștea ta interioară – mai puțin decât o cafea pe săptămână ☕”",
      features: [
        { text: "Acces la biblioteca audio", included: true },
        { text: "Provocări zilnice/săptămânale", included: true },
        { text: "Jurnal personal (fără feedback)", included: true },
        { text: "Feedback personalizat la jurnal", included: false },
        { text: "Webinarii live + arhivă", included: false },
        { text: "Audio-uri exclusive", included: false },
        { text: "Reducere ședințe 1:1", included: false },
      ],
      cta: "Activează Basic",
      gradient: ["#ffffff", "#f2fbff"],
      border: "#4a90e2",
    },
    {
      key: "premium",
      title: "Plan Premium",
      badge: "🔸",
      price: "59 lei/lună",
      subPrice: "18 lei/săptămână (≈ 2,6 lei/zi)",
      tagline:
        "„Sub 3 lei pe zi pentru acces complet la resurse și feedback personalizat – mult mai ieftin decât o ședință la psiholog 🧠”",
      features: [
        { text: "Tot ce include Basic", included: true },
        {
          text: "Feedback personalizat la jurnal (1/săptămână)",
          included: true,
        },
        { text: "Acces la webinarii live + arhiva lor", included: true },
        { text: "Audio-uri exclusive", included: true },
        { text: "Reducere 20% la ședințele 1:1", included: true },
      ],
      cta: "Activează Premium",
      gradient: ["#fff9f2", "#fff2e2"],
      border: "#f0ad4e",
    },
    {
      key: "vip",
      title: "Plan VIP",
      badge: "🔱",
      price: "180 lei/lună",
      subPrice: "≈ 45 lei/săptămână (≈ 6,5 lei/zi)",
      tagline:
        "„Mai puțin de 50 lei pe săptămână pentru acces direct, feedback extins și suport exclusiv – experiență completă pentru mintea ta”",
      features: [
        { text: "Tot ce include Premium", included: true },
        { text: "Feedback extins la jurnale (2–3/săptămână)", included: true },
        { text: "Întrebări directe (1–2/săptămână)", included: true },
        { text: "Webinar lunar VIP (grup restrâns)", included: true },
        { text: "Reducere 40% la ședințele 1:1", included: true },
        { text: "Resurse extra / ghidaje avansate", included: true },
      ],
      cta: "Activează VIP",
      gradient: ["#f5f4ff", "#eceaff"],
      border: "#6c59d9",
    },
  ];

  // Annual mapping derived from monthly (keeps features in one place)
  // Annual plans removed per request

  const annualList = [
    {
      plan: "Basic",
      price: "290 lei/an",
      note: "→ 24 lei/lună (~5,5 lei/săpt.)",
    },
    {
      plan: "Premium",
      price: "590 lei/an",
      note: "→ 49 lei/lună (~11 lei/săpt.)",
    },
    {
      plan: "VIP",
      price: "1.800 lei/an",
      note: "→ 150 lei/lună (~34 lei/săpt.)",
    },
  ];

  const handleSelect = async (planKey) => {
    setSelectedPlan(planKey);
  };

  const handleStartTrial = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token)
        return Alert.alert("Autentificare", "Trebuie să fii autentificat.");
      await api.startTrial(token);
      await refreshSubscription();
      Alert.alert("Trial", "Trial de 3 zile activat.");
    } catch (e) {
      const msg = e.message || "Nu s-a putut activa trialul";
      Alert.alert("Eroare", msg);
      if (
        msg.includes("TRIAL_ALREADY_USED") ||
        msg.includes("Trial deja folosit")
      ) {
        refreshSubscription();
      }
    } finally {
      setLoading(false);
    }
  };

  // Price IDs are resolved server-side based on plan name
  // No client-side price IDs needed - server uses SUBSCRIPTION_PRICE_* env vars

  const handleCheckout = async (planKey) => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token)
        return Alert.alert("Autentificare", "Trebuie să fii autentificat.");

      if (useInAppCheckout) {
        // In-app PaymentSheet flow
        const setupResp = await api.createPaymentSheet(
          { plan: planKey },
          token
        );
        if (!setupResp?.paymentIntentClientSecret)
          throw new Error("Lipsă client secret");

        const initRes = await initPaymentSheet({
          merchantDisplayName: "Dan Anxiety",
          customerId: setupResp.customerId,
          customerEphemeralKeySecret: setupResp.ephemeralKeySecret,
          paymentIntentClientSecret: setupResp.paymentIntentClientSecret,
          allowsDelayedPaymentMethods: false,
          defaultBillingDetails: { email: undefined },
        });
        if (initRes.error) {
          throw new Error(initRes.error.message || "Init PaymentSheet failed");
        }
        const presentRes = await presentPaymentSheet();
        if (presentRes.error) {
          if (presentRes.error.code === "Canceled") {
            return; // user canceled
          }
          throw new Error(presentRes.error.message || "Plata a eșuat");
        }
        // Wait a moment then refresh subscription (webhook should insert new row)
        setTimeout(() => {
          loadSubscription();
        }, 1500);
        Alert.alert("Succes", "Abonament procesat. Se actualizează...");
      } else {
        // Hosted Checkout fallback
        const resp = await api.createCheckout(
          { plan: planKey },
          token
        );
        if (resp?.url) Linking.openURL(resp.url);
        else Alert.alert("Eroare", "Nu s-a primit URL de checkout");
      }
    } catch (e) {
      Alert.alert("Eroare", e.message || "Checkout eșuat");
    } finally {
      setLoading(false);
    }
  };

  const visiblePlans = useMemo(() => {
    return monthlyPlans; // only monthly plans available
  }, [billingCycle]);

  const trialItems = [
    "3–4 audio-uri selectate",
    "Primele 3 provocări",
    "Un webinar înregistrat (nu live)",
    "Jurnal personal (fără feedback de la mine)",
    "Un exemplu de feedback real (anonimizat)",
  ];

  const expiryInfo = useMemo(() => {
    if (!currentSub?.ends_at) return null;
    const endTime = new Date(currentSub.ends_at).getTime();
    if (Number.isNaN(endTime)) return null;
    const diffMs = endTime - now;
    const expired = diffMs <= 0;
    const endDate = new Date(endTime);

    let remaining = "expirat";
    if (!expired) {
      const totalMinutes = Math.round(diffMs / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const parts = [];
      if (days > 0) parts.push(`${days} ${days === 1 ? "zi" : "zile"}`);
      if (hours > 0) parts.push(`${hours} h`);
      if (minutes > 0 && days === 0) parts.push(`${minutes} min`);
      if (!parts.length) parts.push("sub un minut");
      remaining = parts.join(" ");
    }

    return {
      endDate,
      remaining,
      expired,
    };
  }, [currentSub?.ends_at, now]);

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
            <Text style={styles.title}>Abonamente & Acces</Text>
            <Text style={styles.subtitle}>
              Alege nivelul de suport potrivit pentru tine
            </Text>
            {status !== "none" && (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {status === "active"
                    ? currentSub?.type || "activ"
                    : "expirat"}
                </Text>
              </View>
            )}
            {expiryInfo && (
              <View
                style={[
                  styles.expiryBox,
                  expiryInfo.expired && styles.expiryBoxExpired,
                ]}
              >
                <Text style={styles.expiryLabel}>
                  Expiră la {expiryInfo.endDate.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.expiryRemaining,
                    expiryInfo.expired && styles.expiryRemainingExpired,
                  ]}
                >
                  {expiryInfo.expired
                    ? "Abonament expirat"
                    : `Timp rămas: ${expiryInfo.remaining}`}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={loadSubscription}
              style={styles.refreshBtn}
            >
              <Text style={styles.refreshText}>↻</Text>
            </TouchableOpacity>
          </View>

          {/* Annual toggle removed */}

          {visiblePlans.map((plan, idx) => {
            const anim = animValues[idx];
            const scale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            });
            const translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            });
            const selected = selectedPlan === plan.key;
            return (
              <Animated.View
                key={plan.key}
                style={[
                  styles.planCard,
                  {
                    borderColor: selected ? plan.border : plan.border + "55",
                    transform: [{ scale }, { translateY }],
                    opacity: anim,
                  },
                  selected && styles.planCardSelected,
                ]}
              >
                <LinearGradient colors={plan.gradient} style={styles.planInner}>
                  <View style={styles.planHeaderRow}>
                    <Text style={styles.planTitle}>
                      {plan.badge ? `${plan.badge} ${plan.title}` : plan.title}
                    </Text>
                    {selected && (
                      <Text style={styles.selectedBadge}>SELECTAT</Text>
                    )}
                  </View>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planSubPrice}>{plan.subPrice}</Text>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>
                  <View style={styles.featuresWrap}>
                    {plan.features.map((f, i2) => (
                      <View key={i2} style={styles.featureRow}>
                        <Text
                          style={[
                            styles.featureIcon,
                            { opacity: f.included ? 1 : 0.35 },
                          ]}
                        >
                          {f.included ? "✅" : "❌"}
                        </Text>
                        <Text
                          style={[
                            styles.featureText,
                            !f.included && styles.featureTextDim,
                          ]}
                        >
                          {f.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.ctaRow}>
                    <TouchableOpacity
                      onPress={() => handleSelect(plan.key)}
                      style={[
                        styles.selectBtn,
                        selected && styles.selectBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectBtnText,
                          selected && styles.selectBtnTextActive,
                        ]}
                      >
                        {selected ? "Selectat" : "Selectează"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCheckout(plan.key)}
                      style={styles.ctaBtn}
                      disabled={loading}
                    >
                      <LinearGradient
                        colors={["#4a90e2", "#357abd"]}
                        style={styles.ctaGrad}
                      >
                        <Text style={styles.ctaText}>
                          {loading && selectedPlan === plan.key
                            ? "..."
                            : useInAppCheckout
                            ? "Plătește în aplicație"
                            : plan.cta}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            );
          })}

          {/* Annual summary removed */}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Trial de 3 zile</Text>
            <Text style={styles.trialIntro}>
              Toți utilizatorii primesc acces gratuit 3 zile.
            </Text>
            {trialUsed && !currentSub && (
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: "#fff4f2", borderColor: "#f5d0ca" },
                ]}
              >
                <Text
                  style={[
                    styles.noticeText,
                    { color: "#b64a3a", fontWeight: "600" },
                  ]}
                >
                  Ai folosit deja trialul.
                </Text>
              </View>
            )}
            <Text style={styles.trialSubtitle}>În trial au acces la:</Text>
            {trialItems.map((t, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>•</Text>
                <Text style={styles.trialItem}>{t}</Text>
              </View>
            ))}
            <View style={[styles.noticeBox]}>
              <Text style={styles.noticeText}>
                La finalul trialului vei primi o notificare cu invitația de
                upgrade (Basic, Premium sau VIP) și un tabel comparativ.
              </Text>
            </View>
            {!currentSub || currentSub.type !== "trial" ? (
              <TouchableOpacity
                style={[styles.trialCtaOuter, trialUsed && { opacity: 0.5 }]}
                onPress={handleStartTrial}
                disabled={loading || trialUsed}
              >
                <LinearGradient
                  colors={["#6cc04a", "#4a9d2c"]}
                  style={styles.trialCtaGrad}
                >
                  <Text style={styles.trialCtaText}>
                    {trialUsed
                      ? "Trial folosit"
                      : loading
                      ? "..."
                      : "Începe trial de 3 zile"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: "#e0f7e9", borderColor: "#b2e5c6" },
                ]}
              >
                <Text style={[styles.noticeText, { color: "#1e6f3d" }]}>
                  Trial activ până la:{" "}
                  {currentSub.ends_at
                    ? new Date(currentSub.ends_at).toLocaleString()
                    : "—"}
                </Text>
                {currentSub.ends_at && (
                  <Text
                    style={[
                      styles.noticeText,
                      { color: "#1e6f3d", marginTop: 4, fontWeight: "600" },
                    ]}
                  >
                    Rămase:{" "}
                    {Math.max(
                      0,
                      Math.ceil(
                        (new Date(currentSub.ends_at).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    )}{" "}
                    zile
                  </Text>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowCompare(true)}
            style={styles.compareBtn}
          >
            <Text style={styles.compareBtnText}>Compară planurile →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUseInAppCheckout((v) => !v)}
            style={[styles.compareBtn, { marginTop: -12 }]}
          >
            <Text style={[styles.compareBtnText, { fontSize: 12 }]}>
              Mod checkout:{" "}
              {useInAppCheckout ? "In-App PaymentSheet" : "Stripe Hosted Page"}{" "}
              (apasă pentru a schimba)
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {showCompare && (
          <View style={styles.compareOverlay}>
            <View style={styles.compareBox}>
              <Text style={styles.compareTitle}>Compară planurile</Text>
              <View style={styles.compareHeaderRow}>
                <Text style={[styles.compareCell, styles.compareCellHead]}>
                  Funcționalitate
                </Text>
                <Text style={[styles.compareCell, styles.compareCellHead]}>
                  Basic
                </Text>
                <Text style={[styles.compareCell, styles.compareCellHead]}>
                  Premium
                </Text>
                <Text style={[styles.compareCell, styles.compareCellHead]}>
                  VIP
                </Text>
              </View>
              {[
                ["Bibliotecă audio", "✅", "✅", "✅"],
                ["Provocări", "✅", "✅", "✅"],
                ["Jurnal personal", "✅", "✅", "✅"],
                ["Feedback jurnal", "❌", "✅ 1/săpt.", "✅ extins"],
                ["Webinarii live + arhivă", "❌", "✅", "✅"],
                ["Audio-uri exclusive", "❌", "✅", "✅"],
                ["Reducere ședințe 1:1", "❌", "20%", "40%"],
                ["Întrebări directe", "❌", "❌", "✅"],
                ["Webinar VIP lunar", "❌", "❌", "✅"],
              ].map((row, i) => (
                <View
                  style={[
                    styles.compareHeaderRow,
                    i % 2 === 0 && { backgroundColor: "#f6fbff" },
                  ]}
                  key={i}
                >
                  {row.map((cell, ci) => (
                    <Text
                      key={ci}
                      style={[
                        styles.compareCell,
                        ci === 0 && styles.compareCellFirst,
                      ]}
                    >
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
              <TouchableOpacity
                style={styles.closeCompareBtn}
                onPress={() => setShowCompare(false)}
              >
                <LinearGradient
                  colors={["#4a90e2", "#357abd"]}
                  style={styles.closeCompareGrad}
                >
                  <Text style={styles.closeCompareText}>Închide</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: "center", marginBottom: 16 },
  statusPill: {
    position: "absolute",
    top: 40,
    right: 12,
    backgroundColor: "#4a90e2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  refreshBtn: {
    position: "absolute",
    left: 46,
    top: -2,
    backgroundColor: "#fff",
    borderRadius: 18,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    elevation: 2,
  },
  refreshText: { fontSize: 16, color: "#4a90e2", fontWeight: "700" },
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
  },
  backIcon: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#6c7b84",
    textAlign: "center",
    marginTop: 4,
  },
  expiryBox: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e8f4fd",
    alignItems: "center",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expiryBoxExpired: { backgroundColor: "#fff4f2", borderColor: "#f5d0ca" },
  expiryLabel: { fontSize: 12, color: "#2c3e50", fontWeight: "600" },
  expiryRemaining: {
    fontSize: 12,
    color: "#4a90e2",
    marginTop: 4,
    fontWeight: "700",
  },
  expiryRemainingExpired: { color: "#b64a3a" },
  planCard: {
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 22,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  planCardSelected: { borderWidth: 2, shadowOpacity: 0.18 },
  planInner: { padding: 18 },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planTitle: { fontSize: 18, fontWeight: "800", color: "#2c3e50" },
  planPrice: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    color: "#4a90e2",
  },
  planSubPrice: { fontSize: 13, color: "#6c7b84", marginTop: 2 },
  planTagline: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#2c3e50",
    marginTop: 8,
    lineHeight: 18,
  },
  featuresWrap: { marginTop: 10, marginBottom: 8 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  featureIcon: { width: 22 },
  featureText: { flex: 1, fontSize: 14, color: "#2c3e50", lineHeight: 20 },
  featureTextDim: { color: "#8ea4b4" },
  ctaRow: { flexDirection: "row", marginTop: 8, alignItems: "center" },
  selectBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#e6f2fc",
    marginRight: 10,
  },
  selectBtnActive: { backgroundColor: "#4a90e2" },
  selectBtnText: { color: "#2c3e50", fontWeight: "600", fontSize: 13 },
  selectBtnTextActive: { color: "#ffffff" },
  ctaBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  ctaGrad: { paddingVertical: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionBlock: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e8f4fd",
    padding: 16,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 10,
    textAlign: "center",
  },
  annualRow: { marginBottom: 6 },
  annualPlan: { fontWeight: "700", color: "#2c3e50", fontSize: 14 },
  annualPrice: { fontSize: 14, color: "#2c3e50", marginTop: 2 },
  annualNote: { fontSize: 12, color: "#6c7b84" },
  trialIntro: { fontSize: 14, color: "#2c3e50", marginBottom: 8 },
  trialSubtitle: {
    fontSize: 13,
    color: "#6c7b84",
    marginBottom: 6,
    fontWeight: "600",
  },
  trialItem: { flex: 1, fontSize: 14, color: "#2c3e50", lineHeight: 20 },
  noticeBox: {
    marginTop: 12,
    backgroundColor: "#f0f8ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d6ebfa",
  },
  noticeText: { fontSize: 13, color: "#2c3e50", lineHeight: 18 },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#e6f2fc",
    borderRadius: 30,
    padding: 4,
    marginBottom: 18,
    alignSelf: "center",
  },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 26 },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#4a90e2" },
  toggleTextActive: { color: "#2c3e50" },
  selectedBadge: {
    backgroundColor: "#4a90e2",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  trialCtaOuter: {
    marginTop: 14,
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "center",
    minWidth: 220,
  },
  trialCtaGrad: { paddingVertical: 14, alignItems: "center" },
  trialCtaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  compareBtn: { alignSelf: "center", marginTop: -4, marginBottom: 24 },
  compareBtnText: { color: "#4a90e2", fontWeight: "700" },
  compareOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  compareBox: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "#d6ebfa",
  },
  compareTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 12,
  },
  compareHeaderRow: { flexDirection: "row", paddingVertical: 6 },
  compareCell: { flex: 1, fontSize: 11, color: "#2c3e50", textAlign: "center" },
  compareCellHead: { fontWeight: "700", fontSize: 11, color: "#1f3e60" },
  compareCellFirst: { textAlign: "left", paddingLeft: 4 },
  closeCompareBtn: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "center",
    minWidth: 140,
  },
  closeCompareGrad: { paddingVertical: 12, alignItems: "center" },
  closeCompareText: { color: "#ffffff", fontWeight: "700" },
});

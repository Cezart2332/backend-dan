import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "./ui";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getRevenueCatErrorMessage,
  isUserCancelledPurchase,
  OFFERING_IDS,
} from "../utils/revenuecat";

const SERIF = Platform.OS === "ios" ? "Georgia" : "serif";

const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_POLICY_URL = "https://danfostanxios.ro/politica-cookie-uri-ue/";

const OFFERING_DURATION_FALLBACK = {
  [OFFERING_IDS.basic]: "Abonament lunar",
  [OFFERING_IDS.premium]: "Abonament anual",
  [OFFERING_IDS.vip]: "Acces pe viață",
};

const PLAN_FEATURES = {
  basic: [
    { text: "Acces la biblioteca audio", included: true },
    { text: "Provocări zilnice și săptămânale", included: true },
    { text: "Jurnal personal (fără feedback)", included: true },
    { text: "Feedback personalizat la jurnal", included: false },
    { text: "Webinarii live + arhivă", included: false },
    { text: "Audio-uri exclusive", included: false },
    { text: "Reducere la ședințele 1:1", included: false },
  ],
  premium: [
    { text: "Tot ce include Basic", included: true },
    { text: "Feedback personalizat la jurnal (1/săptămână)", included: true },
    { text: "Acces la webinarii live + arhiva lor", included: true },
    { text: "Audio-uri exclusive", included: true },
    { text: "Reducere 20% la ședințele 1:1", included: true },
  ],
  vip: [
    { text: "Tot ce include Premium", included: true },
    { text: "Feedback extins la jurnale (2-3/săptămână)", included: true },
    { text: "Întrebări directe (1-2/săptămână)", included: true },
    { text: "Webinar lunar VIP (grup restrâns)", included: true },
    { text: "Reducere 40% la ședințele 1:1", included: true },
    { text: "Resurse extra / ghidaje avansate", included: true },
  ],
};

const PLAN_TITLES = {
  [OFFERING_IDS.basic]: "Basic",
  [OFFERING_IDS.premium]: "Premium",
  [OFFERING_IDS.vip]: "VIP",
};

function EnterFade({ index = 0, children, style }) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 12) * 50,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function inferDurationLabel(packageItem, fallbackLabel) {
  const period = packageItem?.product?.subscriptionPeriod;

  if (period && typeof period === "object") {
    const unitRaw = String(period?.unit || period?.periodUnit || "").toLowerCase();
    const units = Number(period?.numberOfUnits || period?.value || 1);

    if (unitRaw.includes("month") && units === 1) return "Abonament lunar";
    if (unitRaw.includes("year") && units === 1) return "Abonament anual";
    if (unitRaw.includes("week") && units === 1) return "Abonament săptămânal";
    if (Number.isFinite(units) && units > 1 && unitRaw) {
      return `Se reînnoiește la ${units} ${unitRaw}${units > 1 ? "s" : ""}`;
    }
  }

  const periodText = String(period || "").toLowerCase();
  if (periodText.includes("p1m") || periodText.includes("month")) return "Abonament lunar";
  if (periodText.includes("p1y") || periodText.includes("year")) return "Abonament anual";
  if (periodText.includes("p1w") || periodText.includes("week")) return "Abonament săptămânal";

  const idText = String(
    packageItem?.identifier || packageItem?.packageType || packageItem?.product?.identifier || ""
  ).toLowerCase();
  if (idText.includes("month")) return "Abonament lunar";
  if (idText.includes("year") || idText.includes("annual")) return "Abonament anual";
  if (idText.includes("life")) return "Acces pe viață";

  return fallbackLabel || "Abonament";
}

function formatFriendlyDate(isoText) {
  const ms = isoText ? Date.parse(isoText) : NaN;
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function planLabelFor(subscription) {
  const type = String(subscription?.type || "").toLowerCase();
  if (type === "trial") return "Perioadă de probă";
  const productId = String(subscription?.product_id || "").toLowerCase();
  if (type === "basic" || productId.includes("basic")) return "Basic";
  if (type === "premium" || productId.includes("premium")) return "Premium";
  if (type === "vip" || productId.includes("vip") || productId.includes("life")) return "VIP";
  return "Activ";
}

function ProductCard({ title, durationText, packageItem, selected, onSelect, features, badge }) {
  const priceText = packageItem?.product?.priceString || "Preț indisponibil";

  return (
    <PressableScale
      onPress={onSelect}
      style={[styles.card, selected && styles.cardSelected]}
      scaleTo={0.98}
    >
      {badge ? (
        <View style={styles.recommendBadge}>
          <Text style={styles.recommendBadgeText}>{badge}</Text>
        </View>
      ) : null}

      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDuration}>{durationText}</Text>
        </View>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </View>

      <Text style={styles.cardPrice}>{priceText}</Text>

      <View style={styles.featureList}>
        {features?.map((feature, index) => (
          <View key={`${title}-feature-${index}`} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? "checkmark-circle" : "close-circle-outline"}
              size={17}
              color={feature.included ? "#3d7d5f" : "#b6bfc9"}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, !feature.included && styles.featureTextExcluded]}>
              {feature.text}
            </Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

export default function SubscriptionsScreen({ navigation }) {
  const {
    status,
    hasProEntitlement,
    subscription,
    trialEligible,
    packagesByOffering,
    loading,
    refresh,
    purchasePackage,
    restorePermissions,
    openCustomerCenter,
    startFreeTrial,
  } = useSubscription();

  const [processing, setProcessing] = useState("");
  const [selectedOffering, setSelectedOffering] = useState(OFFERING_IDS.basic);

  const productPackages = useMemo(() => packagesByOffering || {}, [packagesByOffering]);

  const handlePurchase = async () => {
    try {
      setProcessing(`purchase:${selectedOffering}`);
      const selectedPackage = productPackages?.[selectedOffering] || null;
      const result = await purchasePackage(selectedPackage);
      if (!result?.success) {
        throw new Error(result?.error || "Achiziția a eșuat.");
      }
      Alert.alert("Abonament activ", "Mulțumim! Abonamentul tău a fost activat.");
    } catch (error) {
      if (isUserCancelledPurchase(error)) return;
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Achiziția a eșuat."));
    } finally {
      setProcessing("");
    }
  };

  const handleRestaurare = async () => {
    try {
      setProcessing("restore");
      await restorePermissions();
      await refresh();
      Alert.alert("Gata", "Am sincronizat achizițiile tale.");
    } catch (error) {
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Nu am putut restaura achizițiile."));
    } finally {
      setProcessing("");
    }
  };

  const handleCustomerCenter = async () => {
    try {
      setProcessing("customer-center");
      await openCustomerCenter();
      await refresh();
    } catch (error) {
      Alert.alert(
        "Eroare",
        getRevenueCatErrorMessage(error, "Gestionarea abonamentului nu este disponibilă momentan.")
      );
    } finally {
      setProcessing("");
    }
  };

  const handleStartTrial = async () => {
    try {
      setProcessing("trial");
      await startFreeTrial();
      await refresh();
      Alert.alert("Perioadă de probă activată", "Ai 3 zile de acces gratuit. Explorează în liniște.");
    } catch (error) {
      Alert.alert("Eroare", error?.message || "Nu am putut porni perioada de probă.");
    } finally {
      setProcessing("");
    }
  };

  const openLegalLink = async (url, label) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("URL_NOT_SUPPORTED");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", `Nu am putut deschide ${label}.`);
    }
  };

  const isTrialSubscription = String(subscription?.type || "").toLowerCase() === "trial";
  const trialEndsAtMs = subscription?.ends_at ? Date.parse(subscription.ends_at) : NaN;
  const hasActiveTrialAccess =
    isTrialSubscription && (!Number.isFinite(trialEndsAtMs) || trialEndsAtMs > Date.now());
  const canShowTrialAction =
    !hasActiveTrialAccess && (trialEligible || status === "none" || status === "expired");

  const basicPackage = productPackages?.[OFFERING_IDS.basic] || productPackages?.basic;
  const premiumPackage = productPackages?.[OFFERING_IDS.premium] || productPackages?.premium;
  const vipPackage = productPackages?.[OFFERING_IDS.vip] || productPackages?.vip;

  const selectedPackageAvailable = Boolean(productPackages?.[selectedOffering]);
  const selectedPlanTitle = PLAN_TITLES[selectedOffering] || "planul selectat";

  // Stare prietenoasă a abonamentului — fără termeni tehnici.
  const hasActivePaidAccess = hasProEntitlement || (status === "active" && !isTrialSubscription);
  const endsAtFriendly = formatFriendlyDate(subscription?.ends_at);
  let statusCard = null;
  if (hasActiveTrialAccess) {
    statusCard = {
      icon: "clock",
      title: "Perioadă de probă activă",
      detail: endsAtFriendly ? `Ai acces gratuit până pe ${endsAtFriendly}.` : "Ai acces gratuit acum.",
    };
  } else if (hasActivePaidAccess) {
    statusCard = {
      icon: "check-circle",
      title: `Abonament ${planLabelFor(subscription)} activ`,
      detail: endsAtFriendly
        ? subscription?.will_renew === false
          ? `Activ până pe ${endsAtFriendly}.`
          : `Se reînnoiește pe ${endsAtFriendly}.`
        : "Ai acces complet la conținut.",
    };
  } else if (status === "expired") {
    statusCard = {
      icon: "info",
      title: "Abonamentul tău a expirat",
      detail: "Alege un plan de mai jos pentru a continua.",
    };
  }

  let animIndex = 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── Header ── */}
          <EnterFade index={animIndex++}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.headerBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() =>
                  navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Dashboard")
                }
              >
                <Feather name="chevron-left" size={22} color="#24384e" />
              </TouchableOpacity>
              <View style={styles.headerSpacer} />
              <TouchableOpacity
                style={styles.headerBtn}
                disabled={loading || processing === "refresh"}
                onPress={async () => {
                  try {
                    setProcessing("refresh");
                    await refresh();
                  } finally {
                    setProcessing("");
                  }
                }}
              >
                {processing === "refresh" ? (
                  <ActivityIndicator size="small" color="#24384e" />
                ) : (
                  <Feather name="refresh-cw" size={18} color="#24384e" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.overline}>ABONAMENTE</Text>
            <Text style={styles.headline}>Alege planul potrivit pentru tine</Text>
            <Text style={styles.subtitle}>
              Acces complet la metoda lui Dan, în ritmul tău. Anulezi oricând.
            </Text>
          </EnterFade>

          {/* ── Starea abonamentului ── */}
          {statusCard ? (
            <EnterFade index={animIndex++}>
              <View style={styles.statusCard}>
                <View style={styles.statusIconRing}>
                  <Feather name={statusCard.icon} size={18} color="#b3924f" />
                </View>
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>{statusCard.title}</Text>
                  <Text style={styles.statusDetail}>{statusCard.detail}</Text>
                </View>
              </View>
            </EnterFade>
          ) : null}

          {/* ── Planuri ── */}
          <EnterFade index={animIndex++}>
            <ProductCard
              title="Basic"
              durationText={inferDurationLabel(
                basicPackage,
                OFFERING_DURATION_FALLBACK[OFFERING_IDS.basic]
              )}
              packageItem={basicPackage}
              features={PLAN_FEATURES.basic}
              selected={selectedOffering === OFFERING_IDS.basic}
              onSelect={() => setSelectedOffering(OFFERING_IDS.basic)}
            />
          </EnterFade>

          <EnterFade index={animIndex++}>
            <ProductCard
              title="Premium"
              durationText={inferDurationLabel(
                premiumPackage,
                OFFERING_DURATION_FALLBACK[OFFERING_IDS.premium]
              )}
              packageItem={premiumPackage}
              features={PLAN_FEATURES.premium}
              selected={selectedOffering === OFFERING_IDS.premium}
              onSelect={() => setSelectedOffering(OFFERING_IDS.premium)}
              badge="CEL MAI POPULAR"
            />
          </EnterFade>

          <EnterFade index={animIndex++}>
            <ProductCard
              title="VIP"
              durationText={inferDurationLabel(
                vipPackage,
                OFFERING_DURATION_FALLBACK[OFFERING_IDS.vip]
              )}
              packageItem={vipPackage}
              features={PLAN_FEATURES.vip}
              selected={selectedOffering === OFFERING_IDS.vip}
              onSelect={() => setSelectedOffering(OFFERING_IDS.vip)}
            />
          </EnterFade>

          {/* ── Acțiuni ── */}
          <EnterFade index={animIndex++}>
            <PressableScale
              style={[
                styles.primaryBtn,
                (loading || processing.startsWith("purchase") || !selectedPackageAvailable) &&
                  styles.disabledBtn,
              ]}
              onPress={handlePurchase}
              disabled={loading || processing.startsWith("purchase") || !selectedPackageAvailable}
            >
              {processing.startsWith("purchase") ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedPackageAvailable
                    ? `Continuă cu ${selectedPlanTitle}`
                    : "Momentan indisponibil"}
                </Text>
              )}
            </PressableScale>

            {canShowTrialAction ? (
              <PressableScale
                style={[styles.trialBtn, processing === "trial" && styles.disabledBtn]}
                onPress={handleStartTrial}
                disabled={processing === "trial"}
              >
                {processing === "trial" ? (
                  <ActivityIndicator size="small" color="#24384e" />
                ) : (
                  <>
                    <Feather name="gift" size={15} color="#b3924f" />
                    <Text style={styles.trialBtnText}>Încearcă gratuit 3 zile</Text>
                  </>
                )}
              </PressableScale>
            ) : null}

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={handleRestaurare}
                disabled={processing === "restore"}
              >
                {processing === "restore" ? (
                  <ActivityIndicator size="small" color="#5b6a7a" />
                ) : (
                  <Text style={styles.secondaryLinkText}>Restaurează achizițiile</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.secondarySep}>·</Text>
              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={handleCustomerCenter}
                disabled={processing === "customer-center"}
              >
                {processing === "customer-center" ? (
                  <ActivityIndicator size="small" color="#5b6a7a" />
                ) : (
                  <Text style={styles.secondaryLinkText}>Gestionează abonamentul</Text>
                )}
              </TouchableOpacity>
            </View>
          </EnterFade>

          {/* ── Legal ── */}
          <EnterFade index={animIndex++} style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.legalNoticeText}>
              Plata se debitează din contul tău App Store sau Google Play la confirmarea
              achiziției. Abonamentul se reînnoiește automat dacă nu este anulat cu cel puțin 24
              de ore înainte de sfârșitul perioadei curente. Îl poți gestiona sau anula oricând
              din setările contului tău din magazin.
            </Text>
            <View style={styles.legalLinksRow}>
              <TouchableOpacity
                onPress={() => openLegalLink(TERMS_OF_USE_URL, "Termenii de utilizare")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalLinkText}>Termeni de utilizare</Text>
              </TouchableOpacity>
              <Text style={styles.secondarySep}>·</Text>
              <TouchableOpacity
                onPress={() => openLegalLink(PRIVACY_POLICY_URL, "Politica de confidențialitate")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalLinkText}>Confidențialitate</Text>
              </TouchableOpacity>
            </View>
          </EnterFade>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6f7f8" },
  gradient: { flex: 1 },
  content: { padding: 20, paddingBottom: 36 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  headerSpacer: { flex: 1 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.22)",
  },
  overline: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.6,
    color: "#8a97a5",
    marginBottom: 6,
  },
  headline: {
    fontFamily: SERIF,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "#1c2b3a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5b6a7a",
    marginBottom: 22,
  },

  // Starea abonamentului
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(179,146,79,0.45)",
    shadowColor: "#8a6d3b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statusIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(179,146,79,0.1)",
    marginRight: 12,
  },
  statusTextWrap: { flex: 1 },
  statusTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1c2b3a",
    marginBottom: 2,
  },
  statusDetail: {
    fontSize: 12.5,
    color: "#5b6a7a",
    lineHeight: 17,
  },

  // Carduri de plan
  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.24)",
    padding: 18,
    marginBottom: 14,
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: "#24384e",
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  recommendBadge: {
    position: "absolute",
    top: -9,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#b3924f",
  },
  recommendBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardHeaderText: { flex: 1 },
  cardTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: "700",
    color: "#1c2b3a",
    marginBottom: 2,
  },
  cardDuration: {
    fontSize: 12,
    color: "#8a97a5",
    letterSpacing: 0.3,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(32,47,62,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: "#24384e" },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#24384e",
  },
  cardPrice: {
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: "700",
    color: "#24384e",
    marginBottom: 12,
  },
  featureList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(32,47,62,0.18)",
    paddingTop: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  featureIcon: {
    marginTop: 1,
    marginRight: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: "#1c2b3a",
    lineHeight: 18,
  },
  featureTextExcluded: {
    color: "#8a97a5",
  },

  // Acțiuni
  primaryBtn: {
    marginTop: 4,
    backgroundColor: "rgba(28,43,58,0.94)",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: 15,
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  trialBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    minHeight: 48,
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(179,146,79,0.45)",
  },
  trialBtnText: {
    color: "#1c2b3a",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  secondaryLink: { paddingHorizontal: 8, paddingVertical: 6 },
  secondaryLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5b6a7a",
  },
  secondarySep: { color: "#b6bfc9" },
  disabledBtn: { opacity: 0.55 },

  // Legal
  footer: {
    marginTop: 22,
    alignItems: "center",
  },
  footerLine: {
    width: 36,
    height: 1,
    backgroundColor: "rgba(32,47,62,0.2)",
    marginBottom: 14,
  },
  legalNoticeText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: "#8a97a5",
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLinkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#5b6a7a",
    textDecorationLine: "underline",
  },
});

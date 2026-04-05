import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getRevenueCatErrorMessage,
  isUserCancelledPurchase,
  OFFERING_IDS,
} from "../utils/revenuecat";

const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_POLICY_URL = "https://danfostanxios.ro/politica-cookie-uri-ue/";

const OFFERING_DURATION_FALLBACK = {
  [OFFERING_IDS.basic]: "Monthly subscription",
  [OFFERING_IDS.premium]: "Yearly subscription",
  [OFFERING_IDS.vip]: "Lifetime access",
};

const PLAN_FEATURES = {
  basic: [
    { text: "Acces la biblioteca audio", included: true },
    { text: "Provocari zilnice/saptamanale", included: true },
    { text: "Jurnal personal (fara feedback)", included: true },
    { text: "Feedback personalizat la jurnal", included: false },
    { text: "Webinarii live + arhiva", included: false },
    { text: "Audio-uri exclusive", included: false },
    { text: "Reducere sedinte 1:1", included: false },
  ],
  premium: [
    { text: "Tot ce include Basic", included: true },
    { text: "Feedback personalizat la jurnal (1/saptamana)", included: true },
    { text: "Acces la webinarii live + arhiva lor", included: true },
    { text: "Audio-uri exclusive", included: true },
    { text: "Reducere 20% la sedintele 1:1", included: true },
  ],
  vip: [
    { text: "Tot ce include Premium", included: true },
    { text: "Feedback extins la jurnale (2-3/saptamana)", included: true },
    { text: "Intrebari directe (1-2/saptamana)", included: true },
    { text: "Webinar lunar VIP (grup restrans)", included: true },
    { text: "Reducere 40% la sedintele 1:1", included: true },
    { text: "Resurse extra / ghidaje avansate", included: true },
  ],
};

function inferDurationLabel(packageItem, fallbackLabel) {
  const period = packageItem?.product?.subscriptionPeriod;

  if (period && typeof period === "object") {
    const unitRaw = String(period?.unit || period?.periodUnit || "").toLowerCase();
    const units = Number(period?.numberOfUnits || period?.value || 1);

    if (unitRaw.includes("month") && units === 1) return "Monthly subscription";
    if (unitRaw.includes("year") && units === 1) return "Yearly subscription";
    if (unitRaw.includes("week") && units === 1) return "Weekly subscription";
    if (Number.isFinite(units) && units > 1 && unitRaw) {
      return `Renews every ${units} ${unitRaw}${units > 1 ? "s" : ""}`;
    }
  }

  const periodText = String(period || "").toLowerCase();
  if (periodText.includes("p1m") || periodText.includes("month")) return "Monthly subscription";
  if (periodText.includes("p1y") || periodText.includes("year")) return "Yearly subscription";
  if (periodText.includes("p1w") || periodText.includes("week")) return "Weekly subscription";

  const idText = String(
    packageItem?.identifier || packageItem?.packageType || packageItem?.product?.identifier || ""
  ).toLowerCase();
  if (idText.includes("month")) return "Monthly subscription";
  if (idText.includes("year") || idText.includes("annual")) return "Yearly subscription";
  if (idText.includes("life")) return "Lifetime access";

  return fallbackLabel || "Subscription";
}

function ProductCard({ title, subtitle, durationText, packageItem, selected, onSelect, features }) {
  const product = packageItem?.product;
  const priceText = product?.priceString || "Indisponibil momentan";

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      activeOpacity={0.85}
      onPress={onSelect}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {selected ? (
          <View style={styles.selectedPill}>
            <Text style={styles.selectedPillText}>SELECTAT</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <Text style={styles.cardDuration}>{durationText}</Text>
      <Text style={styles.cardPrice}>{priceText}</Text>
      <Text style={styles.cardSku}>{product?.identifier || "Fara SKU mapat"}</Text>

      <View style={styles.featureList}>
        {features?.map((feature, index) => (
          <View key={`${title}-feature-${index}`} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? "checkmark-circle" : "close-circle"}
              size={18}
              color={feature.included ? "#2fa36b" : "#d86767"}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, !feature.included && styles.featureTextExcluded]}>
              {feature.text}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function SubscriptionsScreen({ navigation }) {
  const {
    status,
    hasProEntitlement,
    subscription,
    trialEligible,
    packages,
    packagesByOffering,
    customerInfo,
    offerings,
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
  const availablePackages = offerings?.current?.availablePackages || [];

  const handlePurchase = async () => {
    try {
      setProcessing(`purchase:${selectedOffering}`);
      const selectedPackage = productPackages?.[selectedOffering] || null;
      const result = await purchasePackage(selectedPackage);
      if (!result?.success) {
        throw new Error(result?.error || "Achizitia a esuat.");
      }
      Alert.alert("Succes", "Abonamentul a fost activat.");
    } catch (error) {
      if (isUserCancelledPurchase(error)) return;
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Achizitia a esuat."));
    } finally {
      setProcessing("");
    }
  };

  const handleRestore = async () => {
    try {
      setProcessing("restore");
      await restorePermissions();
      await refresh();
      Alert.alert("Restore", "Am sincronizat achizitiile tale.");
    } catch (error) {
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Nu am putut restaura achizitiile."));
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
        getRevenueCatErrorMessage(error, "Customer Center nu este disponibil pe acest build.")
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
      Alert.alert("Trial activat", "Ai 3 zile de trial gratuit.");
    } catch (error) {
      Alert.alert("Eroare", error?.message || "Nu am putut porni trial-ul gratuit.");
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

  const entitlementLine = hasProEntitlement
    ? `Dan Fost Anxios Pro activ (${subscription?.product_id || "entitlement"})`
    : "Dan Fost Anxios Pro inactiv";

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>
            <Text style={styles.title}>RevenueCat Subscriptions</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
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
                <ActivityIndicator size="small" color="#4a90e2" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#4a90e2" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={styles.statusValue}>{status || "none"}</Text>
            <Text style={styles.entitlementText}>{entitlementLine}</Text>
            <Text style={styles.smallText}>
              Oferte mapate: dan_basic, dan_premium, dan_vip
            </Text>
            <Text style={styles.smallText}>
              Pachete active in offering: {availablePackages.length}
            </Text>
            <Text style={styles.smallText}>
              {availablePackages.length
                ? `Offering SKUs: ${availablePackages
                    .map((pkg) => `${pkg?.identifier}:${pkg?.product?.identifier}`)
                    .join(" | ")}`
                : "Offering SKUs: none"}
            </Text>
            <Text style={styles.smallText}>Pachete totale detectate: {packages?.length || 0}</Text>
          </View>

          <ProductCard
            title="Basic"
            subtitle="Plan Basic"
            durationText={inferDurationLabel(
              basicPackage,
              OFFERING_DURATION_FALLBACK[OFFERING_IDS.basic]
            )}
            packageItem={basicPackage}
            features={PLAN_FEATURES.basic}
            selected={selectedOffering === OFFERING_IDS.basic}
            onSelect={() => setSelectedOffering(OFFERING_IDS.basic)}
          />

          <ProductCard
            title="Premium"
            subtitle="Plan Premium"
            durationText={inferDurationLabel(
              premiumPackage,
              OFFERING_DURATION_FALLBACK[OFFERING_IDS.premium]
            )}
            packageItem={premiumPackage}
            features={PLAN_FEATURES.premium}
            selected={selectedOffering === OFFERING_IDS.premium}
            onSelect={() => setSelectedOffering(OFFERING_IDS.premium)}
          />

          <ProductCard
            title="VIP"
            subtitle="Plan VIP"
            durationText={inferDurationLabel(vipPackage, OFFERING_DURATION_FALLBACK[OFFERING_IDS.vip])}
            packageItem={vipPackage}
            features={PLAN_FEATURES.vip}
            selected={selectedOffering === OFFERING_IDS.vip}
            onSelect={() => setSelectedOffering(OFFERING_IDS.vip)}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (loading || processing.startsWith("purchase")) && styles.disabledBtn]}
            onPress={handlePurchase}
            disabled={loading || processing.startsWith("purchase")}
          >
            {processing.startsWith("purchase") ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Cumpara planul selectat</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, processing === "restore" && styles.disabledBtn]}
            onPress={handleRestore}
            disabled={processing === "restore"}
          >
            {processing === "restore" ? (
              <ActivityIndicator size="small" color="#4a90e2" />
            ) : (
              <Text style={styles.secondaryBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, processing === "customer-center" && styles.disabledBtn]}
            onPress={handleCustomerCenter}
            disabled={processing === "customer-center"}
          >
            {processing === "customer-center" ? (
              <ActivityIndicator size="small" color="#4a90e2" />
            ) : (
              <Text style={styles.secondaryBtnText}>Open Customer Center</Text>
            )}
          </TouchableOpacity>

          {canShowTrialAction ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, processing === "trial" && styles.disabledBtn]}
              onPress={handleStartTrial}
              disabled={processing === "trial"}
            >
              {processing === "trial" ? (
                <ActivityIndicator size="small" color="#4a90e2" />
              ) : (
                <Text style={styles.secondaryBtnText}>
                  {trialEligible
                    ? "Porneste trial gratuit (3 zile)"
                    : "Porneste free trial (verificam eligibilitatea)"}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              style={styles.legalLinkBtn}
              onPress={() => openLegalLink(TERMS_OF_USE_URL, "Terms of use")}
            >
              <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalLinkBtn}
              onPress={() => openLegalLink(PRIVACY_POLICY_URL, "Privacy policy")}
            >
              <Text style={styles.legalLinkText}>Privacy policy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.legalNoticeBox}>
            <Text style={styles.legalNoticeText}>
              Payment will be charged to your Apple ID account at confirmation of purchase.
              Subscriptions auto-renew unless canceled at least 24 hours before the end of the
              current period. Your account will be charged for renewal within 24 hours prior to
              the end of the current period. You can manage or cancel subscriptions in your App
              Store account settings.
            </Text>
          </View>

          <View style={styles.customerInfoBox}>
            <Text style={styles.customerInfoTitle}>Customer Info</Text>
            <Text style={styles.customerInfoText}>
              Original App User ID: {customerInfo?.originalAppUserId || "-"}
            </Text>
            <Text style={styles.customerInfoText}>
              Active entitlements: {Object.keys(customerInfo?.entitlements?.active || {}).join(", ") || "none"}
            </Text>
            <Text style={styles.customerInfoText}>
              Latest expiration: {subscription?.ends_at || "-"}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ddeeff" },
  gradient: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.15)",
  },
  title: {
    fontSize: 18,
    color: "#1a2d45",
    fontWeight: "700",
  },
  statusBox: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  statusLabel: { fontSize: 13, color: "#6c8096" },
  statusValue: { fontSize: 18, color: "#1a2d45", fontWeight: "700", marginTop: 3 },
  entitlementText: { fontSize: 13, color: "#1a2d45", marginTop: 6 },
  smallText: { fontSize: 12, color: "#6c8096", marginTop: 4 },
  card: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: "#4a90e2",
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 18, color: "#1a2d45", fontWeight: "700" },
  cardSubtitle: { fontSize: 13, color: "#6c8096", marginTop: 4 },
  cardDuration: { fontSize: 13, color: "#1a2d45", marginTop: 6, fontWeight: "600" },
  cardPrice: { fontSize: 20, color: "#4a90e2", fontWeight: "700", marginTop: 8 },
  cardSku: { fontSize: 12, color: "#6c8096", marginTop: 6 },
  featureList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(74,144,226,0.15)",
    paddingTop: 10,
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
    color: "#1a2d45",
    lineHeight: 18,
  },
  featureTextExcluded: {
    color: "#76879a",
  },
  selectedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#4a90e2",
  },
  selectedPillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  primaryBtn: {
    marginTop: 6,
    backgroundColor: "#4a90e2",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.35)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  secondaryBtnText: { color: "#1a2d45", fontSize: 14, fontWeight: "600" },
  disabledBtn: { opacity: 0.6 },
  legalLinksRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  legalLinkBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.3)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  legalLinkText: {
    color: "#2f67c4",
    fontSize: 13,
    fontWeight: "700",
  },
  legalNoticeBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 12,
  },
  legalNoticeText: {
    color: "#44586f",
    fontSize: 12,
    lineHeight: 18,
  },
  customerInfoBox: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(74,144,226,0.2)",
    padding: 14,
  },
  customerInfoTitle: { color: "#1a2d45", fontWeight: "700", fontSize: 15, marginBottom: 8 },
  customerInfoText: { color: "#44586f", fontSize: 12, marginTop: 4 },
});

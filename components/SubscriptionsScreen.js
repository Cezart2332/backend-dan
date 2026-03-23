import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import RevenueCatUI from "react-native-purchases-ui";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getRevenueCatErrorMessage,
  isUserCancelledPurchase,
  PRODUCT_IDS,
} from "../utils/revenuecat";

function ProductCard({ title, subtitle, packageItem, selected, onSelect }) {
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
      <Text style={styles.cardPrice}>{priceText}</Text>
      <Text style={styles.cardSku}>{product?.identifier || "Fara SKU mapat"}</Text>
    </TouchableOpacity>
  );
}

export default function SubscriptionsScreen({ navigation }) {
  const {
    status,
    hasProEntitlement,
    subscription,
    customerInfo,
    offerings,
    loading,
    refresh,
    purchaseByProductId,
    restorePurchases,
    showPaywall,
    openCustomerCenter,
    getPackagesByProduct,
  } = useSubscription();

  const [processing, setProcessing] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(PRODUCT_IDS.basic);
  const [showEmbeddedPaywall, setShowEmbeddedPaywall] = useState(false);

  const productPackages = useMemo(() => getPackagesByProduct(), [getPackagesByProduct]);
  const availablePackages = offerings?.current?.availablePackages || [];

  const handlePurchase = async () => {
    try {
      setProcessing(`purchase:${selectedProduct}`);
      await purchaseByProductId(selectedProduct);
      await refresh();
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
      await restorePurchases();
      await refresh();
      Alert.alert("Restore", "Am sincronizat achizitiile tale.");
    } catch (error) {
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Nu am putut restaura achizitiile."));
    } finally {
      setProcessing("");
    }
  };

  const handlePaywall = async () => {
    try {
      setProcessing("paywall");
      await showPaywall();
      await refresh();
    } catch (error) {
      Alert.alert("Eroare", getRevenueCatErrorMessage(error, "Paywall indisponibil momentan."));
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
          </View>

          <ProductCard
            title="Basic"
            subtitle="Plan Basic"
            packageItem={productPackages?.[PRODUCT_IDS.basic] || productPackages?.basic}
            selected={selectedProduct === PRODUCT_IDS.basic}
            onSelect={() => setSelectedProduct(PRODUCT_IDS.basic)}
          />

          <ProductCard
            title="Premium"
            subtitle="Plan Premium"
            packageItem={productPackages?.[PRODUCT_IDS.premium] || productPackages?.premium}
            selected={selectedProduct === PRODUCT_IDS.premium}
            onSelect={() => setSelectedProduct(PRODUCT_IDS.premium)}
          />

          <ProductCard
            title="VIP"
            subtitle="Plan VIP"
            packageItem={productPackages?.[PRODUCT_IDS.vip] || productPackages?.vip}
            selected={selectedProduct === PRODUCT_IDS.vip}
            onSelect={() => setSelectedProduct(PRODUCT_IDS.vip)}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (loading || processing.startsWith("purchase")) && styles.disabledBtn]}
            onPress={handlePurchase}
            disabled={loading || processing.startsWith("purchase")}
          >
            {processing.startsWith("purchase") ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Cumpara produsul selectat</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, processing === "paywall" && styles.disabledBtn]}
            onPress={handlePaywall}
            disabled={processing === "paywall"}
          >
            {processing === "paywall" ? (
              <ActivityIndicator size="small" color="#4a90e2" />
            ) : (
              <Text style={styles.secondaryBtnText}>Deschide RevenueCat Paywall</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, showEmbeddedPaywall && styles.disabledBtn]}
            onPress={() => setShowEmbeddedPaywall(true)}
            disabled={showEmbeddedPaywall}
          >
            <Text style={styles.secondaryBtnText}>Deschide Embedded Paywall</Text>
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

        <Modal
          visible={showEmbeddedPaywall}
          animationType="slide"
          onRequestClose={() => setShowEmbeddedPaywall(false)}
        >
          <View style={styles.embeddedPaywallContainer}>
            <RevenueCatUI.Paywall
              options={offerings?.current ? { offering: offerings.current } : undefined}
              onRestoreCompleted={async () => {
                await refresh();
              }}
              onDismiss={async () => {
                setShowEmbeddedPaywall(false);
                await refresh();
              }}
            />
          </View>
        </Modal>
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
  cardPrice: { fontSize: 20, color: "#4a90e2", fontWeight: "700", marginTop: 8 },
  cardSku: { fontSize: 12, color: "#6c8096", marginTop: 6 },
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
  embeddedPaywallContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

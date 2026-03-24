import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

function getPlatformRevenueCatKey() {
  const isExpoGo = Constants?.appOwnership === "expo";
  const testKey =
    extra?.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ||
    "";
  const iosKey =
    extra?.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
    "";
  const androidKey =
    extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
    "";
  const legacyKey =
    extra?.EXPO_PUBLIC_REVENUECAT_API_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
    "";

  if (isExpoGo) {
    return testKey || legacyKey;
  }

  if (Platform.OS === "ios") return iosKey || legacyKey;
  if (Platform.OS === "android") return androidKey || legacyKey;
  return "";
}

export const REVENUECAT_API_KEY = getPlatformRevenueCatKey();
const IS_TEST_STORE_KEY = /^(rc_|test_)/i.test(String(REVENUECAT_API_KEY || ""));

export const PRO_ENTITLEMENT_ID =
  extra?.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ||
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ||
  "Dan Fost Anxios Pro";
export const OFFERING_ID =
  extra?.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ||
  process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ||
  "";
export const OFFERING_IDS = {
  basic: "dan_basic",
  premium: "dan_premium",
  vip: "dan_vip",
};

export const PLAN_IDS = OFFERING_IDS;
// Backward compatible alias kept for screens still using PRODUCT_IDS naming.
export const PRODUCT_IDS = PLAN_IDS;

const PRODUCT_ALIASES = {
  [PLAN_IDS.basic]: [
    "dan_basic",
    "basic",
    "Basic",
    "basic_subscription",
    "monthly",
    "$rc_monthly",
    "prod769058ac9a",
  ],
  [PLAN_IDS.premium]: [
    "dan_premium",
    "premium",
    "Premium",
    "premium_subscription",
    "yearly",
    "annual",
    "$rc_annual",
    "prodc84db671dc",
  ],
  [PLAN_IDS.vip]: [
    "dan_vip",
    "vip",
    "Vip",
    "vip_subscription",
    "lifetime",
    "$rc_lifetime",
    "prod30e0e21197",
  ],
};

let configured = false;
let currentAppUserId = null;

function isIOSOrAndroid() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function getRevenueCatErrorMessage(error, fallback = "A aparut o eroare la abonament.") {
  if (!error) return fallback;
  if (String(error?.code) === "23") {
    return "Produsul nu este disponibil pentru contul de test sau storefront-ul curent. Verifica Offering-ul curent, pachetele si contul Sandbox.";
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

export function isUserCancelledPurchase(error) {
  return (
    error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    error?.userCancelled === true
  );
}

export async function configureRevenueCat({ appUserID } = {}) {
  if (!isIOSOrAndroid()) return false;
  if (!REVENUECAT_API_KEY) {
    console.warn("RevenueCat disabled: missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.");
    return false;
  }

  try {
    if (!configured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID });
      configured = true;
      currentAppUserId = appUserID || null;
      return true;
    }

    if (appUserID && appUserID !== currentAppUserId) {
      await Purchases.logIn(appUserID);
      currentAppUserId = appUserID;
    }

    return true;
  } catch (error) {
    console.warn("RevenueCat configure failed:", error?.message || error);
    return false;
  }
}

export async function identifyRevenueCatUser(appUserID) {
  if (!isIOSOrAndroid()) return null;
  if (!appUserID) return null;
  if (appUserID === currentAppUserId) {
    return fetchCustomerInfo();
  }
  const result = await Purchases.logIn(appUserID);
  currentAppUserId = appUserID;
  return result?.customerInfo || null;
}

export async function logoutRevenueCatUser() {
  if (!isIOSOrAndroid()) return;
  try {
    await Purchases.logOut();
    currentAppUserId = null;
  } catch {
    // No-op: logOut can fail if SDK was not configured.
  }
}

export async function fetchCustomerInfo() {
  if (!isIOSOrAndroid()) return null;
  return Purchases.getCustomerInfo();
}

export async function fetchOfferings() {
  if (!isIOSOrAndroid()) return null;
  return Purchases.getOfferings();
}

export function getAllPackagesFromOfferings(offerings) {
  if (!offerings?.all) return [];

  const seen = new Set();
  const allPackages = [];

  Object.values(offerings.all).forEach((offering) => {
    const packages = offering?.availablePackages || [];
    packages.forEach((pkg) => {
      const key = `${pkg?.identifier || ""}::${pkg?.product?.identifier || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      allPackages.push(pkg);
    });
  });

  return allPackages;
}

function getTargetOffering(offerings) {
  if (!offerings) return null;
  const byIdentifier = OFFERING_ID ? offerings?.all?.[OFFERING_ID] : null;
  return byIdentifier || offerings?.current || null;
}

function getOfferingById(offerings, offeringId) {
  if (!offerings || !offeringId) return null;
  return offerings?.all?.[offeringId] || null;
}

export function isProEntitlementActive(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID]);
}

export function getProEntitlement(customerInfo) {
  return customerInfo?.entitlements?.all?.[PRO_ENTITLEMENT_ID] || null;
}

export function getPackageForProductId(offerings, productId) {
  const current = getTargetOffering(offerings);
  if (!current?.availablePackages?.length) return null;

  const aliases = PRODUCT_ALIASES[productId] || [productId];
  const normalizedAliases = aliases.map((item) => String(item || "").toLowerCase());

  const exact = current.availablePackages.find((pkg) => {
    const packageId = String(pkg?.identifier || "").toLowerCase();
    const storeProductId = String(pkg?.product?.identifier || "").toLowerCase();
    return normalizedAliases.includes(packageId) || normalizedAliases.includes(storeProductId);
  }
  );
  if (exact) return exact;

  return (
    current.availablePackages.find((pkg) => {
      const id = String(pkg?.identifier || "").toLowerCase();
      const sku = String(pkg?.product?.identifier || "").toLowerCase();
      return normalizedAliases.some((alias) => id.includes(alias) || sku.includes(alias));
    }) || null
  );
}

export function getPackageForOfferingId(offerings, offeringId, planId) {
  const targetOffering = getOfferingById(offerings, offeringId);
  const availablePackages = targetOffering?.availablePackages || [];
  if (!availablePackages.length) return null;

  if (planId) {
    const aliases = PRODUCT_ALIASES[planId] || [planId];
    const normalizedAliases = aliases.map((item) => String(item || "").toLowerCase());
    const byAlias = availablePackages.find((pkg) => {
      const packageId = String(pkg?.identifier || "").toLowerCase();
      const storeProductId = String(pkg?.product?.identifier || "").toLowerCase();
      return normalizedAliases.includes(packageId) || normalizedAliases.includes(storeProductId);
    });
    if (byAlias) return byAlias;
  }

  return availablePackages[0] || null;
}

export async function purchaseRevenueCatPackage(pkg) {
  if (!isIOSOrAndroid()) {
    throw new Error("Achizitiile in-app sunt disponibile doar pe iOS/Android.");
  }
  if (!pkg) {
    throw new Error("Pachetul selectat nu este disponibil in oferta curenta.");
  }

  const result = await Purchases.purchasePackage(pkg);
  return result?.customerInfo || null;
}

export async function restoreRevenueCatPurchases() {
  if (!isIOSOrAndroid()) {
    throw new Error("Restore este disponibil doar pe iOS/Android.");
  }
  return Purchases.restorePurchases();
}

export async function presentRevenueCatPaywall(requiredEntitlementIdentifier = PRO_ENTITLEMENT_ID) {
  if (!isIOSOrAndroid()) {
    throw new Error("Paywall-ul RevenueCat este disponibil doar pe iOS/Android.");
  }

  // RevenueCat Test Store / Preview API mode cannot present native paywall UI.
  if (IS_TEST_STORE_KEY) {
    return {
      result: PAYWALL_RESULT.NOT_PRESENTED,
      success: false,
      reason: "preview_api_mode",
    };
  }

  let paywallResult = PAYWALL_RESULT.NOT_PRESENTED;

  const offerings = await fetchOfferings();
  const targetOffering = getTargetOffering(offerings);

  try {
    if (typeof RevenueCatUI?.presentPaywallIfNeeded === "function") {
      paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
        offering: targetOffering || undefined,
        requiredEntitlementIdentifier,
      });
    } else if (typeof RevenueCatUI?.presentPaywall === "function") {
      paywallResult = await RevenueCatUI.presentPaywall(
        targetOffering ? { offering: targetOffering } : undefined
      );
    } else {
      throw new Error("SDK-ul RevenueCat UI nu este disponibil in acest build.");
    }
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("document is not available") || message.includes("preview api mode")) {
      return {
        result: PAYWALL_RESULT.NOT_PRESENTED,
        success: false,
        reason: "unsupported_runtime",
      };
    }
    throw error;
  }

  const success =
    paywallResult === PAYWALL_RESULT.PURCHASED ||
    paywallResult === PAYWALL_RESULT.RESTORED;

  return {
    result: paywallResult,
    success,
  };
}

export async function presentRevenueCatCustomerCenter() {
  if (!isIOSOrAndroid()) {
    throw new Error("Customer Center este disponibil doar pe iOS/Android.");
  }

  if (typeof RevenueCatUI?.presentCustomerCenter === "function") {
    return RevenueCatUI.presentCustomerCenter();
  }

  throw new Error("Customer Center nu este disponibil in acest build RevenueCat UI.");
}

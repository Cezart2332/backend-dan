import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

function getPlatformRevenueCatKey() {
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

  if (Platform.OS === "ios") return iosKey || legacyKey;
  if (Platform.OS === "android") return androidKey || legacyKey;
  return "";
}

export const REVENUECAT_API_KEY = getPlatformRevenueCatKey();

export const PRO_ENTITLEMENT_ID = "Dan Fost Anxios Pro";
export const PRODUCT_IDS = {
  basic: "Basic",
  premium: "Premium",
  vip: "Vip",
};

const PRODUCT_ALIASES = {
  [PRODUCT_IDS.basic]: ["Basic", "prod769058ac9a"],
  [PRODUCT_IDS.premium]: ["Premium", "prodc84db671dc"],
  [PRODUCT_IDS.vip]: ["Vip", "prod30e0e21197"],
};

let configured = false;

function isIOSOrAndroid() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function getRevenueCatErrorMessage(error, fallback = "A aparut o eroare la abonament.") {
  if (!error) return fallback;
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
      return true;
    }

    if (appUserID) {
      await Purchases.logIn(appUserID);
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
  const result = await Purchases.logIn(appUserID);
  return result?.customerInfo || null;
}

export async function logoutRevenueCatUser() {
  if (!isIOSOrAndroid()) return;
  try {
    await Purchases.logOut();
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

export function isProEntitlementActive(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID]);
}

export function getProEntitlement(customerInfo) {
  return customerInfo?.entitlements?.all?.[PRO_ENTITLEMENT_ID] || null;
}

export function getPackageForProductId(offerings, productId) {
  const current = offerings?.current;
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

  let paywallResult = PAYWALL_RESULT.NOT_PRESENTED;

  if (typeof RevenueCatUI?.presentPaywallIfNeeded === "function") {
    paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier,
    });
  } else if (typeof RevenueCatUI?.presentPaywall === "function") {
    paywallResult = await RevenueCatUI.presentPaywall();
  } else {
    throw new Error("SDK-ul RevenueCat UI nu este disponibil in acest build.");
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

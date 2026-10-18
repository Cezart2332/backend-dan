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

function isIOSOrAndroid() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

const STORE_ERROR_MESSAGES = {
  [PURCHASES_ERROR_CODE.NETWORK_ERROR]: "Nu ne putem conecta la magazin. Verifică conexiunea la internet și încearcă din nou.",
  [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]: "Nu ne putem conecta la magazin. Verifică conexiunea la internet și încearcă din nou.",
  [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: "Magazinul nu răspunde momentan. Încearcă din nou în câteva minute.",
  [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: "Achizițiile nu sunt permise pe acest telefon. Verifică restricțiile contului din magazin.",
  [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR]: "Abonamentul nu este disponibil momentan. Încearcă din nou mai târziu.",
  [PURCHASES_ERROR_CODE.CONFIGURATION_ERROR]: "Abonamentele nu sunt disponibile momentan. Încearcă din nou mai târziu.",
  [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: "Ai deja acest abonament. Folosește „Restaurează achizițiile” ca să-l activezi.",
  [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: "Achiziția este folosită de alt cont din aplicație. Conectează-te cu contul cu care ai cumpărat.",
  [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR]: "Plata este în curs de procesare. Abonamentul se activează imediat ce magazinul o confirmă.",
  [PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR]: "O achiziție este deja în curs. Așteaptă câteva secunde.",
};

// Store errors carry a code and an English message; our own errors are
// already written for people and are shown as they are.
export function getRevenueCatErrorMessage(error, fallback = "A apărut o problemă la abonament. Încearcă din nou.") {
  if (!error) return fallback;
  if (error?.code != null) return STORE_ERROR_MESSAGES[String(error.code)] || fallback;
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
    console.warn("RevenueCat disabled: missing RevenueCat API key for this platform.");
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

    // After a sign-out the SDK runs as a new anonymous user, so the identity is
    // read from the SDK itself rather than from what this module last asked for.
    if (appUserID && (await Purchases.getAppUserID()) !== appUserID) {
      await Purchases.logIn(appUserID);
    }

    return true;
  } catch (error) {
    console.warn("RevenueCat configure failed:", error?.message || error);
    return false;
  }
}

export async function getRevenueCatAppUserId() {
  if (!isIOSOrAndroid() || !configured) return null;
  return Purchases.getAppUserID();
}

// A purchase made while the SDK is anonymous lands on another RevenueCat
// customer and does not unlock this account, so it is never started then.
export async function ensureRevenueCatIdentity(appUserID) {
  if (!isIOSOrAndroid()) return;
  const expected = String(appUserID || "").trim();
  if (expected && (await configureRevenueCat({ appUserID: expected }))) {
    if ((await getRevenueCatAppUserId().catch(() => null)) === expected) return;
  }
  throw new Error(
    "Nu am putut verifica contul pentru abonament. Verifică conexiunea la internet și încearcă din nou."
  );
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
    throw new Error("Achizitiile in-app sunt disponibile doar in aplicatia mobila.");
  }
  if (!pkg) {
    throw new Error("Pachetul selectat nu este disponibil in oferta curenta.");
  }

  const result = await Purchases.purchasePackage(pkg);
  return result?.customerInfo || null;
}

export async function restoreRevenueCatPurchases() {
  if (!isIOSOrAndroid()) {
    throw new Error("Restaurarea achizitiilor este disponibila doar in aplicatia mobila.");
  }
  return Purchases.restorePurchases();
}

export async function presentRevenueCatPaywall(requiredEntitlementIdentifier = PRO_ENTITLEMENT_ID) {
  if (!isIOSOrAndroid()) {
    throw new Error("Abonamentele sunt disponibile doar in aplicatia mobila.");
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
    throw new Error("Gestionarea abonamentului este disponibila doar in aplicatia mobila.");
  }

  if (typeof RevenueCatUI?.presentCustomerCenter === "function") {
    return RevenueCatUI.presentCustomerCenter();
  }

  throw new Error("Customer Center nu este disponibil in acest build RevenueCat UI.");
}

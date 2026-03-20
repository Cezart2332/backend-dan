import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Purchases from "react-native-purchases";
import { getToken } from "../utils/authStorage";
import { getUser } from "../utils/userStorage";
import {
  clearSubscription,
  getSubscription,
  saveSubscription,
} from "../utils/subscriptionStorage";
import {
  configureRevenueCat,
  fetchCustomerInfo,
  fetchOfferings,
  getPackageForProductId,
  getProEntitlement,
  getRevenueCatErrorMessage,
  identifyRevenueCatUser,
  isProEntitlementActive,
  logoutRevenueCatUser,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  PRODUCT_IDS,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../utils/revenuecat";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children, isAuthed }) {
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState("none");
  const [trialEligible, setTrialEligible] = useState(false);
  const [hasProEntitlement, setHasProEntitlement] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const refreshPromiseRef = useRef(null);
  const listenerRef = useRef(null);

  const applyCustomerInfo = useCallback(async (info) => {
    setCustomerInfo(info || null);
    const entitlement = getProEntitlement(info);
    const hasEntitlement = isProEntitlementActive(info);
    setHasProEntitlement(hasEntitlement);

    const entitlementIsExpired = Boolean(entitlement) && !hasEntitlement;
    const nextStatus = hasEntitlement ? "active" : entitlementIsExpired ? "expired" : "none";

    const nextSubscription = hasEntitlement
      ? {
          type: "pro",
          product_id: entitlement?.productIdentifier || null,
          starts_at: entitlement?.latestPurchaseDate || null,
          ends_at: entitlement?.expirationDate || null,
          store: entitlement?.store || null,
          will_renew: entitlement?.willRenew,
        }
      : null;

    setStatus(nextStatus);
    setSubscription(nextSubscription);
    setTrialEligible(false);

    try {
      if (nextSubscription) {
        await saveSubscription({
          ...nextSubscription,
          _status: nextStatus,
          _trialEligible: false,
        });
      } else {
        await saveSubscription({ _status: nextStatus, _trialEligible: false });
      }
    } catch {
      // Cache save failed.
    }
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
      setSubscription(null);
      setStatus("none");
      setTrialEligible(false);
      setHasProEntitlement(false);
      return;
    }
    const { _status, _trialEligible, ...maybeSub } = snapshot;
    const hasSubData = Object.keys(maybeSub).length > 0;
    setSubscription(hasSubData ? maybeSub : null);
    if (_status) setStatus(_status);
    if (typeof _trialEligible === "boolean") setTrialEligible(_trialEligible);
    setHasProEntitlement(Boolean(_status === "active"));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await getSubscription();
        if (mounted) applySnapshot(cached);
      } catch (err) {
        // Cache hydration failed - not critical
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applySnapshot]);

  const clearState = useCallback(async () => {
    refreshPromiseRef.current = null;
    setSubscription(null);
    setStatus("none");
    setTrialEligible(false);
    setHasProEntitlement(false);
    setCustomerInfo(null);
    setOfferings(null);
    setHasToken(false);
    try {
      await clearSubscription();
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const executor = (async () => {
      try {
        const token = await getToken();
        if (!token) {
          await logoutRevenueCatUser();
          await clearState();
          return {
            subscription: null,
            status: "none",
            trialEligible: false,
            hasProEntitlement: false,
            offerings: null,
            customerInfo: null,
          };
        }

        setHasToken(true);
        setLoading(true);
        const user = await getUser();
        const appUserId = user?.id ? String(user.id) : user?.email || null;

        const isConfigured = await configureRevenueCat({ appUserID: appUserId || undefined });
        if (!isConfigured) {
          await clearState();
          return {
            subscription: null,
            status: "none",
            trialEligible: false,
            hasProEntitlement: false,
            offerings: null,
            customerInfo: null,
          };
        }

        if (appUserId) {
          await identifyRevenueCatUser(appUserId);
        }

        const [info, latestOfferings] = await Promise.all([
          fetchCustomerInfo(),
          fetchOfferings(),
        ]);

        setOfferings(latestOfferings || null);
        await applyCustomerInfo(info);

        return {
          subscription: info,
          status: isProEntitlementActive(info) ? "active" : "none",
          trialEligible: false,
          hasProEntitlement: isProEntitlementActive(info),
          offerings: latestOfferings || null,
          customerInfo: info,
        };
      } catch (err) {
        throw new Error(getRevenueCatErrorMessage(err, "Nu am putut sincroniza abonamentul."));
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = executor;
    return executor;
  }, [clearState]);

  useEffect(() => {
    if (listenerRef.current) {
      Purchases.removeCustomerInfoUpdateListener(listenerRef.current);
      listenerRef.current = null;
    }

    if (!isAuthed) {
      logoutRevenueCatUser().finally(() => {
        clearState();
      });
      return;
    }

    const listener = (info) => {
      applyCustomerInfo(info).catch(() => {});
    };
    listenerRef.current = listener;
    Purchases.addCustomerInfoUpdateListener(listener);

    refresh().catch(() => {});

    return () => {
      if (listenerRef.current) {
        Purchases.removeCustomerInfoUpdateListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [isAuthed, clearState, refresh, applyCustomerInfo]);

  const getPackagesByProduct = useCallback(() => {
    const availablePackages = offerings?.current?.availablePackages || [];
    const basicPkg = getPackageForProductId(offerings, PRODUCT_IDS.basic);
    const premiumPkg = getPackageForProductId(offerings, PRODUCT_IDS.premium);
    const vipPkg = getPackageForProductId(offerings, PRODUCT_IDS.vip);

    return {
      basic: basicPkg || availablePackages[0] || null,
      premium: premiumPkg || availablePackages[1] || availablePackages[0] || null,
      vip: vipPkg || availablePackages[2] || availablePackages[availablePackages.length - 1] || null,
    };
  }, [offerings]);

  const purchaseByProductId = useCallback(
    async (productId) => {
      const packages = getPackagesByProduct();
      const pkg = packages?.[productId] || getPackageForProductId(offerings, productId);
      const info = await purchaseRevenueCatPackage(pkg);
      await applyCustomerInfo(info);
      return info;
    },
    [applyCustomerInfo, getPackagesByProduct, offerings]
  );

  const restorePurchases = useCallback(async () => {
    const info = await restoreRevenueCatPurchases();
    await applyCustomerInfo(info);
    return info;
  }, [applyCustomerInfo]);

  const showPaywall = useCallback(async () => {
    const result = await presentRevenueCatPaywall();
    const info = await fetchCustomerInfo();
    await applyCustomerInfo(info);
    return result;
  }, [applyCustomerInfo]);

  const openCustomerCenter = useCallback(async () => {
    const result = await presentRevenueCatCustomerCenter();
    const info = await fetchCustomerInfo();
    await applyCustomerInfo(info);
    return result;
  }, [applyCustomerInfo]);

  useEffect(() => {
    if (!initializing) return;
    if (hasToken) setInitializing(false);
  }, [initializing, hasToken]);

  useEffect(() => {
    if (isAuthed) return;
    if (initializing) setInitializing(false);
  }, [isAuthed, clearState, refresh]);

  const value = useMemo(
    () => ({
      subscription,
      status,
      trialEligible,
      hasProEntitlement,
      customerInfo,
      offerings,
      loading,
      initializing,
      hasToken,
      refresh,
      purchaseByProductId,
      restorePurchases,
      showPaywall,
      openCustomerCenter,
      getPackagesByProduct,
      setTrialEligible: (eligible) => setTrialEligible(Boolean(eligible)),
    }),
    [
      subscription,
      status,
      trialEligible,
      hasProEntitlement,
      customerInfo,
      offerings,
      loading,
      initializing,
      hasToken,
      refresh,
      purchaseByProductId,
      restorePurchases,
      showPaywall,
      openCustomerCenter,
      getPackagesByProduct,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import Purchases from "react-native-purchases";
import { api } from "../utils/api";
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
  getAllPackagesFromOfferings,
  getPackageForOfferingId,
  getPackageForProductId,
  OFFERING_IDS,
  getProEntitlement,
  getRevenueCatErrorMessage,
  identifyRevenueCatUser,
  isProEntitlementActive,
  logoutRevenueCatUser,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  PRO_ENTITLEMENT_ID,
  PLAN_IDS,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../utils/revenuecat";

const SubscriptionContext = createContext(null);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRevenueCatSubscriptionStatus(info) {
  const entitlement = getProEntitlement(info);
  const hasEntitlement = isProEntitlementActive(info);
  const entitlementIsExpired = Boolean(entitlement) && !hasEntitlement;
  return hasEntitlement ? "active" : entitlementIsExpired ? "expired" : "none";
}

function normalizeAppUserId(value) {
  const normalized = String(value || "").trim();
  return normalized.length ? normalized : null;
}

function isPaidSubscriptionType(type) {
  return ["basic", "premium", "vip", "pro"].includes(String(type || "").toLowerCase());
}

function hasPaidHistoryRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  return rows.some((row) => {
    const type = String(row?.type || "").toLowerCase();
    if (type === "trial") return false;
    return (
      isPaidSubscriptionType(type) ||
      Boolean(row?.revenuecat_product_id) ||
      Boolean(row?.stripe_price_id)
    );
  });
}

export function SubscriptionProvider({ children, isAuthed }) {
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState("none");
  const [trialEligible, setTrialEligible] = useState(false);
  const [hasProEntitlement, setHasProEntitlement] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [subscriptionResolved, setSubscriptionResolved] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  // Paywall-ul global se afiseaza doar la cerere (tap pe o sectiune blocata),
  // nu automat pentru utilizatorii fara abonament.
  const [paywallRequested, setPaywallRequested] = useState(false);
  const refreshPromiseRef = useRef(null);
  const listenerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const applyCustomerInfo = useCallback(async (info, { expectedAppUserId } = {}) => {
    setCustomerInfo(info || null);
    const entitlement = getProEntitlement(info);
    const hasEntitlement = isProEntitlementActive(info);

    const currentUser = await getUser();
    const resolvedExpectedAppUserId =
      normalizeAppUserId(expectedAppUserId) ||
      normalizeAppUserId(currentUser?.id) ||
      normalizeAppUserId(currentUser?.email);
    const originalAppUserId = normalizeAppUserId(info?.originalAppUserId);
    const ownershipMismatch =
      hasEntitlement &&
      Boolean(resolvedExpectedAppUserId) &&
      Boolean(originalAppUserId) &&
      resolvedExpectedAppUserId !== originalAppUserId;

    if (ownershipMismatch) {
      setHasProEntitlement(false);
      setStatus("none");
      setSubscription(null);

      try {
        await saveSubscription({ _status: "none", _trialEligible: false });
      } catch {
        // Cache save failed.
      }

      return {
        nextStatus: "none",
        hasEntitlement: false,
        ownershipMismatch: true,
        expectedAppUserId: resolvedExpectedAppUserId,
        originalAppUserId,
      };
    }

    setHasProEntitlement(hasEntitlement);

    const nextStatus = getRevenueCatSubscriptionStatus(info);

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

      // Keep backend subscription status synchronized for admin/reporting and auth checks.
      const token = await getToken();
      if (token) {
        await api.syncRevenueCatSubscription(
          {
            status: nextStatus,
            productId: nextSubscription?.product_id || null,
            startsAt: nextSubscription?.starts_at || null,
            endsAt: nextSubscription?.ends_at || null,
            store: nextSubscription?.store || null,
            willRenew:
              typeof nextSubscription?.will_renew === "boolean"
                ? nextSubscription.will_renew
                : null,
            entitlementId: PRO_ENTITLEMENT_ID,
            appUserId: resolvedExpectedAppUserId || originalAppUserId || null,
          },
          token
        );
      }
    } catch {
      // Cache save failed.
    }

    return {
      nextStatus,
      hasEntitlement,
      ownershipMismatch: false,
      expectedAppUserId: resolvedExpectedAppUserId,
      originalAppUserId,
    };
  }, []);

  const applyBackendSubscription = useCallback(
    async (backendCurrent, { hasRevenueCatEntitlement = false } = {}) => {
      if (!backendCurrent || typeof backendCurrent !== "object") return;

      const backendStatus = backendCurrent.status || "none";
      const backendSub = backendCurrent.subscription || null;
      const backendType = String(backendSub?.type || "").toLowerCase();
      const hasActiveTrial = backendStatus === "active" && backendType === "trial";

      if (hasActiveTrial && !hasRevenueCatEntitlement) {
        const trialSnapshot = {
          type: "trial",
          product_id: "trial",
          starts_at: backendSub?.starts_at || null,
          ends_at: backendSub?.ends_at || null,
          store: "backend-trial",
          will_renew: false,
        };

        setStatus("none");
        setSubscription(trialSnapshot);
        setHasProEntitlement(false);
        setTrialEligible(false);

        try {
          await saveSubscription({
            ...trialSnapshot,
            _status: "none",
            _trialEligible: false,
          });
        } catch {
          // Cache save failed.
        }
        return;
      }

      if (typeof backendCurrent.trialEligible === "boolean") {
        setTrialEligible(backendCurrent.trialEligible);
      }
    },
    []
  );

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
    const isTrialSnapshot = String(maybeSub?.type || "").toLowerCase() === "trial";
    setSubscription(hasSubData ? maybeSub : null);
    if (_status) setStatus(_status);
    if (typeof _trialEligible === "boolean") setTrialEligible(_trialEligible);
    setHasProEntitlement(Boolean(_status === "active" && !isTrialSnapshot));
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
    setSubscriptionResolved(false);
    try {
      await clearSubscription();
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const executor = (async () => {
      try {
        setSubscriptionResolved(false);
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

        const backendCurrentPromise = api.getCurrentSubscription(token).catch(() => null);

        const isConfigured = await configureRevenueCat({ appUserID: appUserId || undefined });
        if (!isConfigured) {
          const backendCurrent = await backendCurrentPromise;
          if (backendCurrent) {
            const backendStatus = backendCurrent.status || "none";
            const backendType = String(backendCurrent?.subscription?.type || "").toLowerCase();
            const hasActiveBackendTrial = backendStatus === "active" && backendType === "trial";

            await applyBackendSubscription(backendCurrent, { hasRevenueCatEntitlement: false });
            return {
              subscription: backendCurrent.subscription || null,
              status: hasActiveBackendTrial ? "none" : backendStatus,
              trialEligible: hasActiveBackendTrial ? false : Boolean(backendCurrent.trialEligible),
              hasProEntitlement: false,
              offerings: null,
              customerInfo: null,
            };
          }

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

        const [info, latestOfferings, backendCurrent] = await Promise.all([
          fetchCustomerInfo(),
          fetchOfferings(),
          backendCurrentPromise,
        ]);

        setOfferings(latestOfferings || null);
        const customerInfoResult = await applyCustomerInfo(info, {
          expectedAppUserId: appUserId || undefined,
        });
        const revenueCatStatus = customerInfoResult?.nextStatus || getRevenueCatSubscriptionStatus(info);
        const hasRevenueCatEntitlement = Boolean(customerInfoResult?.hasEntitlement);
        await applyBackendSubscription(backendCurrent, { hasRevenueCatEntitlement });

        return {
          subscription: info,
          status: revenueCatStatus,
          trialEligible: Boolean(backendCurrent?.trialEligible),
          hasProEntitlement: hasRevenueCatEntitlement,
          offerings: latestOfferings || null,
          customerInfo: info,
        };
      } catch (err) {
        throw new Error(getRevenueCatErrorMessage(err, "Nu am putut sincroniza abonamentul."));
      } finally {
        setSubscriptionResolved(true);
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = executor;
    return executor;
  }, [clearState, applyBackendSubscription]);

  const refreshAfterAccessChange = useCallback(async () => {
    try {
      return await refresh();
    } catch {
      // Billing/entitlement updates can arrive with a short delay after purchase UI closes.
      await wait(700);
      return refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!isAuthed) return;
      if ((prevState === "background" || prevState === "inactive") && nextState === "active") {
        refresh().catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [isAuthed, refresh]);

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

  const getPackagesByOffering = useCallback(() => {
    const basicPkg =
      getPackageForOfferingId(offerings, OFFERING_IDS.basic, PLAN_IDS.basic) ||
      getPackageForProductId(offerings, PLAN_IDS.basic);
    const premiumPkg =
      getPackageForOfferingId(offerings, OFFERING_IDS.premium, PLAN_IDS.premium) ||
      getPackageForProductId(offerings, PLAN_IDS.premium);
    const vipPkg =
      getPackageForOfferingId(offerings, OFFERING_IDS.vip, PLAN_IDS.vip) ||
      getPackageForProductId(offerings, PLAN_IDS.vip);

    const mapped = {
      [PLAN_IDS.basic]: basicPkg || null,
      [PLAN_IDS.premium]: premiumPkg || null,
      [PLAN_IDS.vip]: vipPkg || null,
    };

    // Backward-compatible keys in case any screen still expects basic/premium/vip keys.
    mapped.basic = mapped[PLAN_IDS.basic];
    mapped.premium = mapped[PLAN_IDS.premium];
    mapped.vip = mapped[PLAN_IDS.vip];

    return mapped;
  }, [offerings]);

  const purchaseByOfferingId = useCallback(
    async (offeringId) => {
      const packages = getPackagesByOffering();
      const pkg = packages?.[offeringId] || getPackageForProductId(offerings, offeringId);
      const info = await purchaseRevenueCatPackage(pkg);
      const applyResult = await applyCustomerInfo(info);
      if (applyResult?.ownershipMismatch) {
        throw new Error("Acest abonament este asociat altui cont. Conecteaza-te cu acel cont pentru restore purchases.");
      }
      await refreshAfterAccessChange();
      return info;
    },
    [applyCustomerInfo, getPackagesByOffering, offerings, refreshAfterAccessChange]
  );

  const restorePurchases = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Nu esti autentificat.");

    const historyPayload = await api.getSubscriptionHistory(token).catch(() => null);
    const historyRows = Array.isArray(historyPayload?.history) ? historyPayload.history : [];
    const hasPaidHistory = hasPaidHistoryRows(historyRows);
    const hasPaidSnapshot = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

    if (!hasPaidHistory && !hasPaidSnapshot) {
      throw new Error(
        "Restore purchases este permis doar pentru contul care a cumparat initial abonamentul. Conecteaza-te cu acel cont."
      );
    }

    const info = await restoreRevenueCatPurchases();
    const applyResult = await applyCustomerInfo(info);
    if (applyResult?.ownershipMismatch) {
      throw new Error(
        "Abonamentul detectat este asociat altui cont din aplicatie. Conecteaza-te cu contul original pentru restore purchases."
      );
    }
    return info;
  }, [applyCustomerInfo, hasProEntitlement, subscription]);

  const showPaywall = useCallback(async () => {
    const result = await presentRevenueCatPaywall();
    const info = await fetchCustomerInfo();
    const applyResult = await applyCustomerInfo(info);
    if (applyResult?.ownershipMismatch) {
      throw new Error("Achizitia este asociata altui cont. Conecteaza-te cu acel cont.");
    }
    await refreshAfterAccessChange();
    return result;
  }, [applyCustomerInfo, refreshAfterAccessChange]);

  const openCustomerCenter = useCallback(async () => {
    const result = await presentRevenueCatCustomerCenter();
    const info = await fetchCustomerInfo();
    const applyResult = await applyCustomerInfo(info);
    if (applyResult?.ownershipMismatch) {
      throw new Error("Contul din Customer Center nu corespunde contului curent din aplicatie.");
    }
    return result;
  }, [applyCustomerInfo]);

  const startFreeTrial = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Nu esti autentificat.");
    const result = await api.startTrial(token);
    await refreshAfterAccessChange();
    return result;
  }, [refreshAfterAccessChange]);

  useEffect(() => {
    if (!initializing) return;
    if (hasToken) setInitializing(false);
  }, [initializing, hasToken]);

  useEffect(() => {
    if (isAuthed) return;
    if (initializing) setInitializing(false);
  }, [isAuthed, clearState, refresh]);

  const packagesByOffering = useMemo(() => getPackagesByOffering(), [getPackagesByOffering]);
  const packages = useMemo(() => getAllPackagesFromOfferings(offerings), [offerings]);

  const user = useMemo(
    () => ({
      pro: hasProEntitlement,
      subscription,
      appUserId: customerInfo?.originalAppUserId || null,
      activeEntitlements: Object.keys(customerInfo?.entitlements?.active || {}),
    }),
    [hasProEntitlement, subscription, customerInfo]
  );

  const purchasePackage = useCallback(
    async (pkg) => {
      const info = await purchaseRevenueCatPackage(pkg);
      const applyResult = await applyCustomerInfo(info);
      if (applyResult?.ownershipMismatch) {
        throw new Error("Achizitia este asociata altui cont. Conecteaza-te cu acel cont.");
      }
      await refreshAfterAccessChange();
      return { success: true, customerInfo: info };
    },
    [applyCustomerInfo, refreshAfterAccessChange]
  );

  const restorePermissions = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Nu esti autentificat.");

    const historyPayload = await api.getSubscriptionHistory(token).catch(() => null);
    const historyRows = Array.isArray(historyPayload?.history) ? historyPayload.history : [];
    const hasPaidHistory = hasPaidHistoryRows(historyRows);
    const hasPaidSnapshot = hasProEntitlement || isPaidSubscriptionType(subscription?.type);

    if (!hasPaidHistory && !hasPaidSnapshot) {
      throw new Error(
        "Restore purchases este permis doar pentru contul care a cumparat initial abonamentul. Conecteaza-te cu acel cont."
      );
    }

    const info = await restoreRevenueCatPurchases();
    const applyResult = await applyCustomerInfo(info);
    if (applyResult?.ownershipMismatch) {
      throw new Error(
        "Abonamentul detectat este asociat altui cont din aplicatie. Conecteaza-te cu contul original pentru restore purchases."
      );
    }
    return info;
  }, [applyCustomerInfo, hasProEntitlement, subscription]);

  const requestPaywall = useCallback(() => setPaywallRequested(true), []);
  const dismissPaywall = useCallback(() => setPaywallRequested(false), []);

  const value = useMemo(
    () => ({
      user,
      packages,
      packagesByOffering,
      subscription,
      status,
      trialEligible,
      hasProEntitlement,
      customerInfo,
      offerings,
      loading,
      initializing,
      subscriptionResolved,
      hasToken,
      paywallRequested,
      requestPaywall,
      dismissPaywall,
      refresh,
      purchaseByOfferingId,
      restorePurchases,
      purchasePackage,
      restorePermissions,
      showPaywall,
      openCustomerCenter,
      startFreeTrial,
      getPackagesByOffering,
      offeringsLoaded: Boolean(offerings),
      // Backward-compatible aliases for existing screens.
      purchaseByProductId: purchaseByOfferingId,
      getPackagesByProduct: getPackagesByOffering,
      setTrialEligible: (eligible) => setTrialEligible(Boolean(eligible)),
    }),
    [
      user,
      packages,
      packagesByOffering,
      subscription,
      status,
      trialEligible,
      hasProEntitlement,
      customerInfo,
      offerings,
      loading,
      initializing,
      subscriptionResolved,
      hasToken,
      paywallRequested,
      requestPaywall,
      dismissPaywall,
      refresh,
      purchaseByOfferingId,
      restorePurchases,
      purchasePackage,
      restorePermissions,
      showPaywall,
      openCustomerCenter,
      startFreeTrial,
      getPackagesByOffering,
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

// RevenueCat-style alias for easier migration from examples/docs.
export const useRevenueCat = useSubscription;

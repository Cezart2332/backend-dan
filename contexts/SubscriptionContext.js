import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import Purchases from "react-native-purchases";
import { api } from "../utils/api";
import { getToken } from "../utils/authStorage";
import { getUser } from "../utils/userStorage";
import {
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
  isProEntitlementActive,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  PRO_ENTITLEMENT_ID,
  PLAN_IDS,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../utils/revenuecat";

import { cachedSubscription, liveSubscription } from '../utils/subscriptionPolicy.mjs';

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

  const snapshotRevisionRef = useRef(0);
  const activeOwnerRef = useRef(null);
  const epochRef = useRef(0);
  const authedRef = useRef(isAuthed);
  authedRef.current = isAuthed;
  const applySnapshot = useCallback((snapshot) => {
    snapshotRevisionRef.current++;
    const { _ownerId, _status = 'none', _trialEligible = false, ...sub } = snapshot || {};
    setSubscription(sub.type ? sub : null);
    setStatus(_status);
    setTrialEligible(_trialEligible);
    setHasProEntitlement(_status === 'active' && isPaidSubscriptionType(sub.type));
  }, []);
  const sameSession = useCallback(async (owner, token, epoch) => {
    const [user, currentToken] = await Promise.all([getUser(), getToken()]);
    return authedRef.current && epochRef.current === epoch &&
      normalizeAppUserId(user?.id) === owner && currentToken === token;
  }, []);
  const describeCustomer = useCallback((info, owner) => {
    const entitlement = getProEntitlement(info);
    const hasEntitlement = isProEntitlementActive(info);
    const originalAppUserId = normalizeAppUserId(info?.originalAppUserId);
    return {
      nextStatus: getRevenueCatSubscriptionStatus(info), hasEntitlement,
      ownershipMismatch: hasEntitlement && Boolean(originalAppUserId) && originalAppUserId !== owner,
      expectedAppUserId: owner, originalAppUserId,
      subscription: hasEntitlement ? { type: 'pro', product_id: entitlement?.productIdentifier || null,
        starts_at: entitlement?.latestPurchaseDate || null, ends_at: entitlement?.expirationDate || null,
        store: entitlement?.store || null, will_renew: entitlement?.willRenew } : null,
    };
  }, []);
  const syncCustomer = useCallback((result, token) => {
    if (result.ownershipMismatch) return;
    const sub = result.subscription;
    // Server synchronization does not hold the dashboard or the billing UI open.
    api.syncRevenueCatSubscription({ status: result.nextStatus, productId: sub?.product_id || null,
      startsAt: sub?.starts_at || null, endsAt: sub?.ends_at || null, store: sub?.store || null,
      willRenew: typeof sub?.will_renew === 'boolean' ? sub.will_renew : null,
      entitlementId: PRO_ENTITLEMENT_ID, appUserId: result.expectedAppUserId }, token).catch(() => {});
  }, []);
  const applyCustomerInfo = useCallback(async (info, { expectedAppUserId } = {}) => {
    const epoch = epochRef.current, token = await getToken();
    const owner = normalizeAppUserId(expectedAppUserId) || normalizeAppUserId((await getUser())?.id);
    const result = describeCustomer(info, owner);
    if (!owner || !await sameSession(owner, token, epoch)) return { ...result, ownershipMismatch: true };
    const commitEpoch = ++epochRef.current;
    refreshPromiseRef.current = null;
    const snapshot = liveSubscription({ owner, revenueCat: result });
    setCustomerInfo(info || null); applySnapshot(snapshot);
    setSubscriptionResolved(true); setLoading(false);
    await saveSubscription(snapshot);
    if (await sameSession(owner, token, commitEpoch)) syncCustomer(result, token);
    return result;
  }, [applySnapshot, describeCustomer, sameSession, syncCustomer]);

  // Hydrate account-scoped access immediately. Network validation is independent.
  useEffect(() => {
    let live = true;
    if (!isAuthed) { setInitializing(false); return; }
    const epoch = epochRef.current, revision = snapshotRevisionRef.current;
    (async () => {
      const owner = normalizeAppUserId((await getUser())?.id), token = await getToken();
      if (!owner || !live || !await sameSession(owner, token, epoch)) return;
      activeOwnerRef.current = owner;
      const snapshot = await getSubscription();
      if (live && await sameSession(owner, token, epoch) && revision === snapshotRevisionRef.current) applySnapshot(cachedSubscription(snapshot, owner));
    })().catch(() => {}).finally(() => { if (live) setInitializing(false); });
    return () => { live = false; };
  }, [isAuthed, applySnapshot, sameSession]);

  const clearState = useCallback(() => {
    epochRef.current++; activeOwnerRef.current = null; refreshPromiseRef.current = null;
    setSubscription(null); setStatus('none'); setTrialEligible(false); setHasProEntitlement(false);
    setCustomerInfo(null); setOfferings(null); setHasToken(false); setSubscriptionResolved(false);
    setPaywallRequested(false); setLoading(false);
    // Explicit sign-out cleanup owns SDK logout and cache deletion. Avoid a late
    // logOut callback clearing a newly signed-in account or flushing startup cache.
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const epoch = epochRef.current;
    const executor = (async () => {
      const token = await getToken(), owner = normalizeAppUserId((await getUser())?.id);
      if (!owner || !token || !await sameSession(owner, token, epoch)) return null;
      activeOwnerRef.current = owner; setHasToken(true); setLoading(true);
      try {
        const backendPromise = api.getCurrentSubscription(token).catch(() => null);
        // configureRevenueCat already identifies the user once, without a second logIn.
        const configured = await configureRevenueCat({ appUserID: owner });
        const [customer, latestOfferings, backendResult] = await Promise.allSettled([
          configured ? fetchCustomerInfo() : Promise.resolve(null),
          configured ? fetchOfferings() : Promise.resolve(null), backendPromise,
        ]);
        if (!await sameSession(owner, token, epoch)) return null;
        const info = customer.status === 'fulfilled' ? customer.value : null;
        const backend = backendResult.status === 'fulfilled' ? backendResult.value : null;
        const rc = info ? describeCustomer(info, owner) : null;
        const snapshot = liveSubscription({ owner, backend, revenueCat: rc });
        if (!snapshot) throw new Error('Nu am putut sincroniza abonamentul.');
        applySnapshot(snapshot);
        if (info) setCustomerInfo(info);
        if (latestOfferings.status === 'fulfilled' && latestOfferings.value) setOfferings(latestOfferings.value);
        await saveSubscription(snapshot);
        if (rc && await sameSession(owner, token, epoch)) syncCustomer(rc, token);
        return { subscription: snapshot.type ? snapshot : null, status: snapshot._status,
          trialEligible: snapshot._trialEligible, hasProEntitlement: snapshot._status === 'active',
          offerings: latestOfferings.status === 'fulfilled' ? latestOfferings.value : null, customerInfo: info };
      } catch (error) {
        throw new Error(getRevenueCatErrorMessage(error, 'Nu am putut sincroniza abonamentul.'));
      } finally {
        if (await sameSession(owner, token, epoch)) { setSubscriptionResolved(true); setLoading(false); }
        if (refreshPromiseRef.current === executor) refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = executor;
    const release = () => { if (refreshPromiseRef.current === executor) refreshPromiseRef.current = null; };
    executor.then(release, release);
    return executor;
  }, [applySnapshot, describeCustomer, sameSession, syncCustomer]);

  useEffect(() => {
    const end = Date.parse(subscription?.ends_at || '');
    if (!Number.isFinite(end)) return;
    const expire = () => {
      if (Date.now() < end) return;
      setSubscription(null); setHasProEntitlement(false); setStatus('expired');
    };
    let timer;
    const schedule = () => {
      const remaining = end - Date.now();
      if (remaining <= 0) expire();
      else timer = setTimeout(schedule, Math.min(remaining, 2147483647));
    };
    schedule();
    const foreground = AppState.addEventListener('change', state => state === 'active' && expire());
    return () => { clearTimeout(timer); foreground.remove(); };
  }, [subscription]);

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
      clearState();
      return;
    }

    const listener = (info) => {
      const owner = activeOwnerRef.current;
      if (!owner || normalizeAppUserId(info?.originalAppUserId) !== owner) return;
      refresh().catch(() => {});
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

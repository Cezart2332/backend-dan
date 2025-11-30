import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../utils/api";
import { getToken } from "../utils/authStorage";
import {
  clearSubscription,
  getSubscription,
  saveSubscription,
} from "../utils/subscriptionStorage";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children, isAuthed }) {
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState("none");
  const [trialEligible, setTrialEligible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const refreshPromiseRef = useRef(null);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
      setSubscription(null);
      setStatus("none");
      setTrialEligible(false);
      return;
    }
    const { _status, _trialEligible, ...maybeSub } = snapshot;
    const hasSubData = Object.keys(maybeSub).length > 0;
    setSubscription(hasSubData ? maybeSub : null);
    if (_status) setStatus(_status);
    if (typeof _trialEligible === "boolean") setTrialEligible(_trialEligible);
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
          await clearState();
          return { subscription: null, status: "none", trialEligible: false };
        }
        setHasToken(true);
        setLoading(true);
        const res = await api.getCurrentSubscription(token);
        const nextSub = res?.subscription || null;
        const nextStatus = res?.status || "none";
        const nextTrialEligible = Boolean(res?.trialEligible);
        setSubscription(nextSub);
        setStatus(nextStatus);
        setTrialEligible(nextTrialEligible);
        try {
          if (nextSub) {
            await saveSubscription({
              ...nextSub,
              _status: nextStatus,
              _trialEligible: nextTrialEligible,
            });
          } else {
            await saveSubscription({
              _status: nextStatus,
              _trialEligible: nextTrialEligible,
            });
          }
        } catch (err) {
          // Cache save failed - not critical
        }
        return { subscription: nextSub, status: nextStatus, trialEligible: nextTrialEligible };
      } catch (err) {
        // Refresh failed
        throw err;
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = executor;
    return executor;
  }, [clearState]);

  useEffect(() => {
    if (!isAuthed) {
      clearState();
      return;
    }
    refresh().catch(() => {});
  }, [isAuthed, clearState, refresh]);

  const value = useMemo(
    () => ({
      subscription,
      status,
      trialEligible,
      loading,
      initializing,
      hasToken,
      refresh,
      setTrialEligible: (eligible) => setTrialEligible(Boolean(eligible)),
    }),
    [subscription, status, trialEligible, loading, initializing, hasToken, refresh]
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

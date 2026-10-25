import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import { getUser } from '../utils/userStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';
import { useSubscription } from './SubscriptionContext';
import { accessAllowed, confirmedAccess, DEFAULT_PREFERENCES } from '../utils/wellbeingCore.mjs';
import { wellbeingRepository as repository, setWellbeingAccount, stopWellbeingAccount, syncWellbeing, scheduleWellbeingReminder } from '../utils/wellbeingRuntime';

const Context = createContext(null);
const SERVER_RECHECK_MS = 10 * 60 * 1000;
export function WellbeingProvider({ isAuthed, children }) {
  const subscriptionContext = useSubscription();
  const [owner, setOwner] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const ownerRef = useRef(null);
  const refreshRef = useRef(null);
  const busy = useRef(false);
  const pendingRefresh = useRef(false);
  const pendingPull = useRef(false);
  const onlineProof = useRef(false);
  const lastServerCheck = useRef(0);
  const [onlineVerified, setOnlineVerified] = useState(false);
  // True when the last server check failed for a reason other than a verdict,
  // so the gate can say "no connection" instead of "no subscription".
  const [verifyFailed, setVerifyFailed] = useState(false);
  const appAccess = useMemo(() => confirmedAccess(owner, subscriptionContext), [owner, subscriptionContext.hasProEntitlement, subscriptionContext.status, subscriptionContext.subscription]);
  const appAccessRef = useRef(appAccess); appAccessRef.current = appAccess;
  const allowed = Boolean(isAuthed && (accessAllowed(data?.access, owner, now, onlineVerified) || accessAllowed(appAccess, owner, now, true)));
  const reload = useCallback(async (id = ownerRef.current) => {
    if (!id) return;
    const next = await repository.read(id);
    if (ownerRef.current === id) setData(next);
  }, []);
  const refresh = useCallback(async (options = {}) => {
    const id = ownerRef.current;
    const pull = options.pull !== false;
    if (!id) return;
    if (busy.current) { pendingRefresh.current = true; pendingPull.current ||= pull; return; }
    busy.current = true;
    try {
      const token = await getToken();
      if (!token || ownerRef.current !== id) return;
      // Access the subscription layer already confirmed needs no second server
      // round trip; it is stored so SOS also opens offline until its expiry.
      const confirmed = appAccessRef.current;
      const confirmedLive = accessAllowed(confirmed, id, Date.now(), true);
      if (confirmedLive) {
        await repository.update(id, { access: { ...confirmed, checkedAt: new Date().toISOString() } });
        setVerifyFailed(false);
      } else if (options.periodic && Date.now() - lastServerCheck.current < SERVER_RECHECK_MS) {
        // The minute timer asks the server again only every few minutes; opening
        // the app, reconnecting or a subscription change still check at once.
      } else {
        // Network failure preserves the last confirmed, finite expiry.
        try {
          const result = await api.getCurrentSubscription(token);
          if (ownerRef.current !== id) return;
          lastServerCheck.current = Date.now();
          onlineProof.current = true; setOnlineVerified(true); setVerifyFailed(false);
          await repository.update(id, { access: { owner: id, status: result.status, type: result.subscription?.type, expiresAt: result.subscription?.ends_at, checkedAt: new Date().toISOString() } });
        } catch (failure) {
          if (ownerRef.current !== id) return;
          onlineProof.current = false; setOnlineVerified(false);
          if (failure.status === 401) {
            await repository.update(id, { access: null });
          } else setVerifyFailed(true);
        }
      }
      if (ownerRef.current !== id) return;
      const snapshot = await repository.read(id);
      await reload(id);
      await scheduleWellbeingReminder(id).catch(() => {});
      if (accessAllowed(snapshot.access, id, Date.now(), onlineProof.current || confirmedLive)) {
        await syncWellbeing(id, token, { pull });
        await reload(id);
        await scheduleWellbeingReminder(id).catch(() => {});
      }
      if (ownerRef.current === id) setError(null);
    } catch (failure) { if (ownerRef.current === id) setError(failure.message); }
    finally {
      busy.current = false;
      if (pendingRefresh.current) {
        const pullAgain = pendingPull.current;
        pendingRefresh.current = false; pendingPull.current = false;
        if (ownerRef.current && AppState.currentState === 'active') Promise.resolve().then(() => refreshRef.current({ pull: pullAgain }));
      }
    }
  }, [reload]);
  refreshRef.current = refresh;
  useEffect(() => {
    let active = true;
    ownerRef.current = null;
    onlineProof.current = false; setOnlineVerified(false); lastServerCheck.current = 0;
    setOwner(null); setData(null); setError(null); setVerifyFailed(false);
    stopWellbeingAccount().catch(() => {});
    if (isAuthed) (async () => {
      const user = await getUser();
      if (!active) return;
      if (!user?.id) { setError('Datele contului lipsesc. Ieși și autentifică-te din nou.'); return; }
      const id = String(user.id);
      ownerRef.current = id; setOwner(id); setWellbeingAccount(id);
      try { await reload(id); await refreshRef.current(); } catch (failure) { if (active) setError(failure.message); }
    })();
    return () => { active = false; ownerRef.current = null; stopWellbeingAccount().catch(() => {}); };
  }, [isAuthed, reload]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') { setNow(Date.now()); refreshRef.current(); } else { onlineProof.current = false; setOnlineVerified(false); } });
    const network = NetInfo.addEventListener((state) => { if (state.isConnected && state.isInternetReachable !== false && AppState.currentState === 'active') refreshRef.current(); else { onlineProof.current = false; setOnlineVerified(false); } });
    const timer = setInterval(() => { setNow(Date.now()); if (AppState.currentState === 'active') refreshRef.current({ pull: false, periodic: true }); }, 60000);
    return () => { listener.remove(); network(); clearInterval(timer); };
  }, []);
  useEffect(() => { if (owner) refreshRef.current(); }, [owner, subscriptionContext.status, subscriptionContext.subscription?.ends_at]);
  useEffect(() => { if (owner) scheduleWellbeingReminder(owner).catch(() => {}); }, [allowed, owner]);

  const save = async (kind, record, allowExistingSession = false, expectedOwner = ownerRef.current) => {
    // An admitted SOS may finish during logout, but always belongs to its original account.
    const id = kind === 'sessions' && allowExistingSession ? expectedOwner : ownerRef.current;
    if (!id) throw new Error('Autentifică-te din nou.');
    const snapshot = await repository.read(id);
    if (!accessAllowed(snapshot.access, id, Date.now(), onlineProof.current) && !(kind === 'sessions' && allowExistingSession)) throw new Error('Este necesar un abonament plătit activ.');
    const next = await repository.save(id, kind, record);
    if (ownerRef.current === id) setData(next);
    if (ownerRef.current === id) {
      scheduleWellbeingReminder(id).catch(() => {});
      refreshRef.current({ pull: false });
    }
    return record.clientId;
  };
  const metadata = () => ({ clientId: Crypto.randomUUID(), occurredAt: new Date().toISOString(), timezoneOffset: new Date().getTimezoneOffset(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '' });
  const updatePreferences = async (changes) => {
    if (!allowed) throw new Error('Este necesar un abonament plătit activ.');
    const id = ownerRef.current;
    if (changes.reminder === true) {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Permite notificările din setările telefonului.');
    }
    if (ownerRef.current !== id) throw new Error('Contul s-a schimbat.');
    let previousReminder;
    await repository.update(id, (current) => {
      previousReminder = Boolean(current.preferences.reminder);
      return { preferences: { ...DEFAULT_PREFERENCES, ...current.preferences, ...changes }, reminderAnchor: current.reminderAnchor || new Date().toISOString(), ...(changes.reminder === true ? { reminderScheduledFor: null } : {}) };
    });
    await reload(id);
    if (changes.reminder !== undefined) {
      try { await scheduleWellbeingReminder(id); }
      catch (failure) {
        await repository.update(id, (current) => ({ preferences: { ...current.preferences, reminder: current.preferences.reminder === changes.reminder ? previousReminder : current.preferences.reminder } }));
        await reload(id);
        throw failure;
      }
    }
  };
  const updateKit = async (kit) => {
    if (!allowed) throw new Error('Este necesar un abonament plătit activ.');
    const id = ownerRef.current;
    await repository.update(id, { kit }); await reload(id);
  };
  const recheckAccess = () => { subscriptionContext.refresh().catch(() => {}); return refresh(); };
  return <Context.Provider value={{ owner, data, ready: Boolean(owner && data), allowed, error, verifyFailed, recheckAccess, preferences: { ...DEFAULT_PREFERENCES, ...data?.preferences }, refresh, reload, save, metadata, updatePreferences, updateKit, requestPaywall: subscriptionContext.requestPaywall }}>{children}</Context.Provider>;
}
export function useWellbeing() { return useContext(Context); }

import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import DashboardContent from "./DashboardContent";
import { getToken } from "../utils/authStorage";
import { getUser, saveUser } from "../utils/userStorage";
import { signOutCleanup } from "../utils/session";
import { useSubscription } from "../contexts/SubscriptionContext";
import { api, toAbsoluteApiUrl } from "../utils/api";
import { setAppBadgeCount } from "../utils/appBadge";

// Slug-urile CMS legate de secțiunile existente din aplicație.
// Conținutul lor apare direct în ecranele respective, nu la "Conținut nou".
const BUILTIN_CMS_SLUGS = new Set([
  "tehnica-hai",
  "tehnica-hai-psihologice",
  "tehnica-hai-fizice",
  "audio-anxietate",
  "ajutor-anxietate",
  "ajutor-atac-panica",
  "din-experienta-mea",
]);

export default function DashboardScreen({ navigation, onLogout }) {
  const { subscription, hasProEntitlement, requestPaywall } = useSubscription();
  const subType = subscription?.type || null;
  const normalizedSubType = String(subType || "").toLowerCase();
  const hasWebinarAccess = ["premium", "vip", "pro"].includes(normalizedSubType);
  const hasPaidSub = hasProEntitlement || ["basic", "premium", "vip", "pro"].includes(normalizedSubType);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(null);
  const [cmsSections, setCmsSections] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadSocial, setUnreadSocial] = useState(0);

  const refreshUnreadNotifications = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const [notifications, chat, social] = await Promise.allSettled([
      api.getUnreadNotificationsCount(token),
      api.getChatUnreadCount(token),
      api.getSocialUnreadCount(token),
    ]);
    // Un contor care eșuează își păstrează valoarea până la următorul focus.
    const notificationCount =
      notifications.status === "fulfilled" ? Number(notifications.value?.unreadCount) || 0 : null;
    const chatCount = chat.status === "fulfilled" ? Number(chat.value?.unreadCount) || 0 : null;

    if (notificationCount !== null) setUnreadNotifications(notificationCount);
    if (chatCount !== null) setUnreadChat(chatCount);
    if (social.status === 'fulfilled') setUnreadSocial(Number(social.value?.unreadCount) || 0);
    if (notificationCount !== null && chatCount !== null) {
      setAppBadgeCount(notificationCount + chatCount);
    }
  }, []);

  const applyProfilePreview = useCallback((userPayload) => {
    const resolvedName = String(userPayload?.name || "").trim();
    setProfileName(resolvedName);
    setProfileAvatarUrl(toAbsoluteApiUrl(userPayload?.avatar_url));
  }, []);

  const refreshProfilePreview = useCallback(async () => {
    const localUser = await getUser();
    if (localUser) {
      applyProfilePreview(localUser);
    }

    const token = await getToken();
    if (!token) return;

    try {
      const response = await api.getProfile(token);
      const profileUser = response?.user || null;
      if (!profileUser) return;

      const mergedUser = {
        ...(localUser || {}),
        ...profileUser,
        name: String(profileUser?.name || "").trim(),
      };

      await saveUser(mergedUser);
      applyProfilePreview(mergedUser);
    } catch {
      // Silent failure: keep local cache fallback.
    }
  }, [applyProfilePreview]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      refreshProfilePreview().catch(() => {});
      refreshUnreadNotifications().catch(() => {});
    });

    refreshProfilePreview().catch(() => {});
    refreshUnreadNotifications().catch(() => {});
    return unsubscribe;
  }, [navigation, refreshProfilePreview, refreshUnreadNotifications]);

  useEffect(() => {
    api.getCmsVideoSections()
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];
        // Secțiunile atașate ecranelor existente apar în interiorul acelor
        // ecrane, nu ca dubluri la "Conținut nou".
        setCmsSections(items.filter((s) => !BUILTIN_CMS_SLUGS.has(String(s.slug || "").toLowerCase())));
      })
      .catch((err) => console.warn("[CMS] dashboard:", err));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOutCleanup();
    } finally {
      if (typeof onLogout === "function") onLogout();
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  }, [navigation, onLogout]);

  // Secțiuni disponibile doar cu abonament plătit (trial și fără abonament → blocate).
  const paidOnlyIds = new Set([4, 5, 6, 7, 10]);
  // Deschise oricui, chiar și fără niciun abonament: chatul comunității și abonamentele.
  const freeForAllIds = new Set([9, 12]);
  const trialEndsAtMs = subscription?.ends_at ? Date.parse(subscription.ends_at) : NaN;
  const hasActiveTrial =
    normalizedSubType === "trial" && (!Number.isFinite(trialEndsAtMs) || trialEndsAtMs > Date.now());
  const hasNoPlan = !hasPaidSub && !hasActiveTrial;

  const lockStateFor = (id) => {
    const webinarLocked = id === 11 && !hasWebinarAccess;
    const contentLocked = paidOnlyIds.has(id) && !hasPaidSub;
    const noPlanLocked = hasNoPlan && !freeForAllIds.has(id);
    const locked = webinarLocked || contentLocked || noPlanLocked;
    const lockLabel =
      webinarLocked && !noPlanLocked ? "Disponibil cu Premium/VIP" : "Disponibil cu abonament";
    return { locked, lockLabel };
  };

  // Utilizatorii cu trial activ primesc un mesaj clasic; cei fără niciun
  // abonament văd ecranul de paywall (doar la tap pe o secțiune blocată).
  const showLockedPrompt = (message) => {
    if (hasNoPlan) {
      requestPaywall();
      return;
    }
    Alert.alert("Funcție restricționată", message, [
      { text: "Vezi abonamente", onPress: () => navigation.navigate("Subscriptions") },
      { text: "OK", style: "cancel" },
    ]);
  };

  const handleMenuPress = (item) => {
    const { locked } = lockStateFor(item.id);
    if (locked) {
      showLockedPrompt(
        item.id === 11
          ? "Accesul la webinarii necesită Premium sau VIP."
          : "Această funcție este disponibilă doar cu un abonament activ. Alege un plan pentru acces complet."
      );
      return;
    }

    const routes = {
      1: "Progress",
      2: "QuoteOfTheDay",
      3: "Provocari",
      4: "Direct",
      5: "Intrebari",
      6: "Tehnici",
      7: "Ajutor",
      8: "AboutDan",
      9: "Subscriptions",
      10: "AudioAnxietateList",
      11: "Webinarii",
      12: "CommunityChat",
    };
    if (routes[item.id]) navigation.navigate(routes[item.id]);
  };

  return <DashboardContent
    navigation={navigation}
    profileName={profileName}
    profileAvatarUrl={profileAvatarUrl}
    subType={subType}
    unreadNotifications={unreadNotifications}
    unreadChat={unreadChat}
    unreadSocial={unreadSocial}
    cmsSections={cmsSections}
    hasPaidSub={hasPaidSub}
    lockStateFor={lockStateFor}
    handleMenuPress={handleMenuPress}
    showLockedPrompt={showLockedPrompt}
    handleLogout={handleLogout}
  />;
}

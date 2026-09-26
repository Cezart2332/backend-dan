import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { PressableScale } from "./ui";
import { clearSubscription } from "../utils/subscriptionStorage";
import { clearToken, getToken } from "../utils/authStorage";
import { clearUser, getUser, saveUser } from "../utils/userStorage";
import { clearEntries } from "../utils/progressStorage";
import { replaceAllRuns } from "../utils/challengeStorage";
import { logoutRevenueCatUser } from "../utils/revenuecat";
import { useSubscription } from "../contexts/SubscriptionContext";
import { api, toAbsoluteApiUrl } from "../utils/api";
import { clearAppBadge, setAppBadgeCount } from "../utils/appBadge";
import { hapticImpact } from "../utils/haptics";
import { useTheme, useThemedStyles } from "./ui/themeContext";

const SERIF = Platform.OS === "ios" ? "Georgia" : "serif";

function EnterFade({ index = 0, children, style }) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 12) * 50,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Inelul iconiței SOS „respiră" încet (4s inspiră / expiră), iar un halou
 * se extinde și se estompează — un memento subtil de calm, pe tema aplicației.
 */
function BreathingIcon({ children }) {
  const styles = useThemedStyles(createStyles);
  const breath = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  return (
    <View style={styles.sosIconWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sosHalo,
          {
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
            transform: [
              { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.sosIconRing,
          {
            transform: [
              { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** Etichetă de secțiune centrată, cu hairline-uri ornamentale pe laturi. */
function SectionLabel({ children }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelLine} />
      <Text style={styles.sectionLabel}>{children}</Text>
      <View style={styles.labelLine} />
    </View>
  );
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Bună dimineața";
  if (h < 18) return "Bună ziua";
  return "Bună seara";
}

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
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
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

  const refreshUnreadNotifications = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const [notifications, chat] = await Promise.allSettled([
      api.getUnreadNotificationsCount(token),
      api.getChatUnreadCount(token),
    ]);
    // Un contor care eșuează își păstrează valoarea până la următorul focus.
    const notificationCount =
      notifications.status === "fulfilled" ? Number(notifications.value?.unreadCount) || 0 : null;
    const chatCount = chat.status === "fulfilled" ? Number(chat.value?.unreadCount) || 0 : null;

    if (notificationCount !== null) setUnreadNotifications(notificationCount);
    if (chatCount !== null) setUnreadChat(chatCount);
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
      await Promise.all([
        logoutRevenueCatUser(),
        clearToken(),
        clearUser(),
        clearSubscription(),
        clearEntries(),
        replaceAllRuns([]),
      ]);
      clearAppBadge();
    } catch (err) {
      // Logout cleanup failed - proceed anyway
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
      10: "IntelegeAnxietate",
      11: "Webinarii",
      12: "CommunityChat",
    };
    if (routes[item.id]) navigation.navigate(routes[item.id]);
  };

  // "Pentru azi" — trei acțiuni scurte, zilnice
  const todayTiles = [
    { id: 2, label: "Gândul zilei", iconName: "message-circle" },
    { id: 1, label: "Progresul meu", iconName: "bar-chart-2" },
    { id: 3, label: "Provocări", iconName: "award" },
  ];

  // Secțiuni tematice
  const sections = [
    {
      key: "drum",
      title: "Drumul tău",
      items: [
        {
          id: 6,
          title: "Tehnica HAI",
          subtitle: "Metoda care elimină anxietatea, pas cu pas",
          iconName: "feather",
        },
        {
          id: 10,
          title: "Înțelege anxietatea",
          subtitle: "Audio-uri și video explicative",
          iconName: "headphones",
        },
        {
          id: 8,
          title: "Eu sunt Dan fost anxios",
          subtitle: "Povestea din spatele metodei",
          iconName: "user",
        },
      ],
    },
    {
      key: "dan",
      title: "Împreună cu Dan",
      items: [
        {
          id: 4,
          title: "Intră în direct cu Dan",
          subtitle: "Sau trimite-i jurnalul tău pentru analiză",
          iconName: "video",
        },
        {
          id: 5,
          title: "Trimite-mi o întrebare",
          subtitle: "Primești răspuns personal",
          iconName: "help-circle",
        },
        {
          id: 11,
          title: "Webinarii",
          subtitle: "Acces live + înregistrări",
          iconName: "cast",
        },
        {
          id: 12,
          title: "Comunitate chat",
          subtitle: "Discuții în timp real cu comunitatea",
          iconName: "message-square",
        },
      ],
    },
  ];

  let animIndex = 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[tc("#f6f7f8", 'bg'), tc("#f3f4f6", 'bg'), tc("#eef0f2", 'bg')]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <EnterFade index={animIndex++} style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.overline}>{greetingForNow().toUpperCase()}</Text>
              <Text style={styles.headline}>
                {profileName ? profileName : "În spațiul tău sigur"}
              </Text>
              {subType ? (
                <View style={styles.subRow}>
                  <View style={styles.subDot} />
                  <Text style={styles.subText}>Plan {subType.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              <PressableScale
                onPress={() => navigation.navigate("Notifications")}
                style={styles.bellRing}
                scaleTo={0.92}
              >
                <Feather name="bell" size={19} color={tc("#24384e", 'fg')} />
                {unreadNotifications > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </PressableScale>

              <PressableScale
                onPress={() => navigation.navigate("Profile")}
                style={styles.avatarRing}
                scaleTo={0.92}
              >
                {profileAvatarUrl ? (
                  <Image source={{ uri: profileAvatarUrl }} style={styles.avatar} />
                ) : (
                  <Feather name="user" size={22} color={tc("#24384e", 'fg')} />
                )}
              </PressableScale>
            </View>
          </EnterFade>

          {/* ── SOS ── */}
          <EnterFade index={animIndex++}>
            <PressableScale
              onPress={() => {
                hapticImpact("medium");
                handleMenuPress({ id: 7 });
              }}
            >
              <LinearGradient
                colors={[tc("rgba(28,43,58,0.94)", 'bg'), tc("rgba(22,34,47,0.97)", 'bg')]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sosCard}
              >
                <BreathingIcon>
                  <Feather name="wind" size={22} color={tc("#f6f7f8", 'fg')} />
                </BreathingIcon>
                <View style={styles.sosTextWrap}>
                  <Text style={styles.sosTitle}>Am nevoie de ajutor acum</Text>
                  <Text style={styles.sosSubtitle}>
                    Respiră. Intervenție ghidată, imediat.
                  </Text>
                </View>
                <Feather name="arrow-right" size={20} color={tc("rgba(246,247,248,0.85)", 'fg')} />
              </LinearGradient>
            </PressableScale>
          </EnterFade>

          {/* ── Pentru azi ── */}
          <EnterFade index={animIndex++}>
            <SectionLabel>Pentru azi</SectionLabel>
            <View style={styles.tilesRow}>
              {todayTiles.map((tile) => (
                <PressableScale
                  key={tile.id}
                  onPress={() => handleMenuPress(tile)}
                  containerStyle={styles.tileContainer}
                  style={styles.tile}
                  scaleTo={0.95}
                >
                  <View style={styles.tileIconRing}>
                    <Feather name={tile.iconName} size={19} color={tc("#24384e", 'fg')} />
                  </View>
                  <View style={styles.tileLabelWrap}>
                    <Text
                      style={styles.tileLabel}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.2}
                    >
                      {tile.label}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </EnterFade>

          {/* ── Secțiuni ── */}
          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <EnterFade index={animIndex++}>
                <SectionLabel>{section.title}</SectionLabel>
              </EnterFade>
              <EnterFade index={animIndex++} style={styles.groupCard}>
                {section.items.map((item, i) => {
                  const { locked, lockLabel } = lockStateFor(item.id);
                  return (
                    <View key={item.id}>
                      {i > 0 ? <View style={styles.rowDivider} /> : null}
                      <PressableScale
                        onPress={() => handleMenuPress(item)}
                        style={[styles.row, locked && styles.rowLocked]}
                        scaleTo={0.985}
                      >
                        <View style={styles.rowIconRing}>
                          <Feather
                            name={item.iconName}
                            size={18}
                            color={locked ? tc("#9aa5b1", 'fg') : tc("#24384e", 'fg')}
                          />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, locked && styles.rowTitleLocked]}>
                            {item.title}
                          </Text>
                          <Text style={styles.rowSubtitle} numberOfLines={2}>
                            {locked ? lockLabel : item.subtitle}
                          </Text>
                        </View>
                        {!locked && item.id === 12 && unreadChat > 0 ? (
                          <View style={styles.rowBadge}>
                            <Text style={styles.rowBadgeText}>
                              {unreadChat > 99 ? "99+" : unreadChat}
                            </Text>
                          </View>
                        ) : null}
                        <Feather
                          name={locked ? "lock" : "chevron-right"}
                          size={17}
                          color={locked ? tc("#b6bfc9", 'fg') : tc("#8a97a5", 'fg')}
                        />
                      </PressableScale>
                    </View>
                  );
                })}
              </EnterFade>
            </View>
          ))}

          {/* ── Conținut nou (CMS) ── */}
          {cmsSections.length > 0 && (
            <View style={styles.section}>
              <EnterFade index={animIndex++}>
                <SectionLabel>Conținut nou</SectionLabel>
              </EnterFade>
              <EnterFade index={animIndex++} style={styles.groupCard}>
                {cmsSections.map((section, i) => {
                  const locked = !hasPaidSub;
                  return (
                    <View key={`cms-section-${section.id}`}>
                      {i > 0 ? <View style={styles.rowDivider} /> : null}
                      <PressableScale
                        onPress={() => {
                          if (locked) {
                            showLockedPrompt("Acest conținut este disponibil doar cu abonament activ.");
                            return;
                          }
                          navigation.navigate("CmsSection", { slug: section.slug, title: section.title });
                        }}
                        style={[styles.row, locked && styles.rowLocked]}
                        scaleTo={0.985}
                      >
                        <View style={styles.rowIconRing}>
                          <Feather
                            name={locked ? "lock" : "layers"}
                            size={18}
                            color={locked ? tc("#9aa5b1", 'fg') : tc("#24384e", 'fg')}
                          />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, locked && styles.rowTitleLocked]}>
                            {section.title}
                          </Text>
                          <Text style={styles.rowSubtitle} numberOfLines={2}>
                            {locked ? "Disponibil cu abonament" : section.description || "Conținut video"}
                          </Text>
                        </View>
                        <Feather
                          name={locked ? "lock" : "chevron-right"}
                          size={17}
                          color={locked ? tc("#b6bfc9", 'fg') : tc("#8a97a5", 'fg')}
                        />
                      </PressableScale>
                    </View>
                  );
                })}
              </EnterFade>
            </View>
          )}

          {/* ── Abonament ── */}
          <EnterFade index={animIndex++}>
            <PressableScale
              onPress={() => handleMenuPress({ id: 9 })}
              style={styles.planRow}
              scaleTo={0.985}
            >
              <Feather name="star" size={16} color={tc("#b3924f", 'fg')} />
              <Text style={styles.planText}>Abonamente & Acces</Text>
              <Text style={styles.planMeta}>Basic · Premium · VIP</Text>
              <Feather name="chevron-right" size={16} color={tc("#8a97a5", 'fg')} />
            </PressableScale>
          </EnterFade>

          {/* ── Comunitate externă ── */}
          <EnterFade index={animIndex++} style={styles.externalRow}>
            <PressableScale
              containerStyle={styles.externalBtnContainer}
              style={styles.externalBtn}
              scaleTo={0.95}
              onPress={() => Linking.openURL("https://www.facebook.com/groups/820094195023604/")}
            >
              <Feather name="users" size={15} color={tc("#24384e", 'fg')} />
              <Text
                style={styles.externalText}
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
              >
                Grup Facebook
              </Text>
            </PressableScale>
            <PressableScale
              containerStyle={styles.externalBtnContainer}
              style={styles.externalBtn}
              scaleTo={0.95}
              onPress={() => Linking.openURL("https://danfostanxios.ro/testimoniale-2/")}
            >
              <Feather name="heart" size={15} color={tc("#24384e", 'fg')} />
              <Text
                style={styles.externalText}
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
              >
                Testimoniale
              </Text>
            </PressableScale>
          </EnterFade>

          {/* ── Footer ── */}
          <EnterFade index={animIndex++} style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.medicalNote}>
              Aplicația oferă conținut informativ și sprijin pentru stare de bine — nu
              înlocuiește un consult medical.{" "}
              <Text
                style={styles.medicalLink}
                onPress={() => navigation.navigate("MedicalInfo")}
              >
                Detalii și surse
              </Text>
            </Text>

            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => navigation.navigate("Terms")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.footerBtnText}>Termeni</Text>
              </TouchableOpacity>
              <Text style={styles.footerSep}>·</Text>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => navigation.navigate("Settings")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.footerBtnText}>Setări</Text>
              </TouchableOpacity>
              <Text style={styles.footerSep}>·</Text>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={handleLogout}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.footerBtnText, styles.footerLogout]}>Ieșire</Text>
              </TouchableOpacity>
            </View>
          </EnterFade>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc("#f6f7f8", 'bg') },
  gradient: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  headerText: { flex: 1, paddingRight: 12 },
  overline: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.6,
    color: tc("#8a97a5", 'fg'),
    marginBottom: 6,
  },
  headline: {
    fontFamily: SERIF,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: tc("#1c2b3a", 'fg'),
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tc("#b3924f", 'bg'),
    marginRight: 6,
  },
  subText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: tc("#5b6a7a", 'fg'),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.3)", 'bg'),
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("#a8544c", 'bg'),
    borderWidth: 1.5,
    borderColor: tc("#f6f7f8", 'bg'),
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: tc("#fff", 'fg'),
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.3)", 'bg'),
    overflow: "hidden",
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },

  // SOS
  sosCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 26,
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  sosIconWrap: {
    width: 44,
    height: 44,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sosIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tc("rgba(246,247,248,0.35)", 'bg'),
  },
  sosHalo: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tc("rgba(246,247,248,0.55)", 'bg'),
  },
  sosTextWrap: { flex: 1, paddingRight: 10 },
  sosTitle: {
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: "700",
    color: tc("#f6f7f8", 'fg'),
    marginBottom: 3,
  },
  sosSubtitle: {
    fontSize: 12.5,
    color: tc("rgba(246,247,248,0.72)", 'fg'),
  },

  // Etichete de secțiune — centrate, cu hairline-uri ornamentale
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  labelLine: {
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tc("rgba(32,47,62,0.3)", 'bg'),
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: tc("#8a97a5", 'fg'),
    textAlign: "center",
  },
  section: { marginBottom: 24 },

  // Tiles "Pentru azi"
  tilesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  tileContainer: { flex: 1 },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 108,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 20,
    backgroundColor: tc("rgba(255,255,255,0.62)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.24)", 'bg'),
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  tileIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(36,56,78,0.06)", 'bg'),
    marginBottom: 9,
  },
  // Spațiu rezervat pentru 2 rânduri: iconițele rămân aliniate între tiles,
  // chiar dacă o etichetă se rupe pe două rânduri.
  tileLabelWrap: {
    minHeight: 32,
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: tc("#1c2b3a", 'fg'),
    textAlign: "center",
  },

  // Grupuri de rânduri
  groupCard: {
    borderRadius: 22,
    backgroundColor: tc("rgba(255,255,255,0.62)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.24)", 'bg'),
    // fără overflow: "hidden" — pe iOS ar tăia umbra; rândurile sunt oricum transparente
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowLocked: { opacity: 0.55 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tc("rgba(32,47,62,0.16)", 'bg'),
    marginLeft: 62,
  },
  rowIconRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(36,56,78,0.06)", 'bg'),
    marginRight: 12,
  },
  rowText: { flex: 1, paddingRight: 8 },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: tc("#1c2b3a", 'fg'),
    marginBottom: 2,
  },
  rowTitleLocked: { color: tc("#8a97a5", 'fg') },
  rowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("#24384e", 'bg'),
    marginRight: 8,
  },
  rowBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: tc("#fff", 'fg'),
  },
  rowSubtitle: {
    fontSize: 12.5,
    color: tc("#5b6a7a", 'fg'),
    lineHeight: 17,
  },

  // Abonament
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: tc("rgba(255,255,255,0.62)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(179,146,79,0.45)", 'bg'),
    marginBottom: 14,
    shadowColor: "#8a6d3b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  planText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: tc("#1c2b3a", 'fg'),
  },
  planMeta: {
    fontSize: 11,
    color: tc("#8a97a5", 'fg'),
    marginRight: 4,
  },

  // Linkuri externe — centrate, dimensionate după conținut
  externalRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  externalBtnContainer: {
    flexShrink: 1,
    maxWidth: "48%",
  },
  externalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: tc("rgba(255,255,255,0.62)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.24)", 'bg'),
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  externalText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: tc("#1c2b3a", 'fg'),
  },

  // Footer
  footer: {
    marginTop: "auto",
    paddingTop: 20,
    alignItems: "center",
  },
  footerLine: {
    width: 36,
    height: 1,
    backgroundColor: tc("rgba(32,47,62,0.2)", 'bg'),
    marginBottom: 14,
  },
  medicalNote: {
    fontSize: 11.5,
    lineHeight: 17,
    color: tc("#8a97a5", 'fg'),
    textAlign: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  medicalLink: {
    color: tc("#5b6a7a", 'fg'),
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  footerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: tc("#5b6a7a", 'fg'),
  },
  footerLogout: { color: tc("#a8544c", 'fg') },
  footerSep: { color: tc("#b6bfc9", 'fg') },
});

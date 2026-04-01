import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { clearSubscription } from "../utils/subscriptionStorage";
import { clearToken } from "../utils/authStorage";
import { clearUser } from "../utils/userStorage";
import { clearEntries } from "../utils/progressStorage";
import { replaceAllRuns } from "../utils/challengeStorage";
import { logoutRevenueCatUser } from "../utils/revenuecat";
import { useSubscriptionAccessState } from "../contexts/SubscriptionContext";

const { width } = Dimensions.get("window");

export default function DashboardScreen({ navigation, onLogout }) {
  const { subscription } = useSubscriptionAccessState();
  const subType = subscription?.type || null;

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
    } catch (err) {
      // Logout cleanup failed - proceed anyway
    } finally {
      if (typeof onLogout === "function") onLogout();
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  }, [navigation, onLogout]);
  const menuItems = [
    // 1) SOS first
    {
      id: 7,
      title: "Ajutor",
      subtitle: "Am nevoie acum",
      iconName: "alert-circle-outline",
      color: "#6cc04a",
    },
    // 2) Tehnici second
    {
      id: 6,
      title: "Tehnica HAI – metoda care elimină anxietatea",
      subtitle: "Descoperă pașii și aplicațiile",
      iconName: "leaf-outline",
      color: "#2bbbad",
    },
    // 3) About Dan
    {
      id: 8,
      title: "Eu sunt Dan fost anxios",
      subtitle: "Cunoaște-mă",
      iconName: "person-circle-outline",
      color: "#9b59b6",
    },
    // Rest of items
    {
      id: 1,
      title: "Progresul meu",
      subtitle: "Urmărește-ți evoluția",
      iconName: "bar-chart-outline",
      color: "#4a90e2",
    },
    {
      id: 2,
      title: "Gândul de azi de la Dan",
      subtitle: "Înțelepciune zilnică",
      iconName: "chatbubble-ellipses-outline",
      color: "#5cb85c",
    },
    {
      id: 3,
      title: "Provocări",
      subtitle: "Depășește-ți limitele",
      iconName: "trophy-outline",
      color: "#f0ad4e",
    },
    {
      id: 4,
      title:
        "Intră în direct cu Dan sau trimite-i jurnalul lui Dan pentru analiza",
      subtitle: "Conectează-te direct",
      iconName: "videocam-outline",
      color: "#d9534f",
    },
    {
      id: 5,
      title: "Trimite-mi o întrebare",
      subtitle: "Pune-ți întrebările",
      iconName: "help-circle-outline",
      color: "#5bc0de",
    },
    {
      id: 9,
      title: "Abonamente & Acces",
      subtitle: "Planuri Basic / Premium / VIP",
      iconName: "diamond-outline",
      color: "#ff8c42",
    },
    {
      id: 10,
      title: "Înțelege anxietatea",
      subtitle: "Audio-uri și video explicative",
      iconName: "headset-outline",
      color: "#8e44ad",
    },
  ];

  // Items locked during free trial (only available with paid subscription)
  const trialLockedIds = new Set([4, 5, 6, 7, 10]);
  const isTrial = subType === 'trial';

  const handleMenuPress = (item) => {
    // Block locked items during trial
    if (isTrial && trialLockedIds.has(item.id)) {
      const { Alert } = require('react-native');
      Alert.alert(
        'Funcție restricționată',
        'Această funcție este disponibilă doar cu un abonament activ. Alege un plan pentru acces complet.',
        [
          { text: 'Vezi abonamente', onPress: () => navigation.navigate('Subscriptions') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    // Here you can navigate to different screens based on the item
    if (item.id === 1) {
      // Progresul meu
      navigation.navigate("Progress");
    } else if (item.id === 2) {
      // Gândul de azi de la Dan
      navigation.navigate("QuoteOfTheDay");
    } else if (item.id === 3) {
      // Provocări
      navigation.navigate("Provocari");
    } else if (item.id === 4) {
      // Intra in direct cu Dan / trimite jurnal
      navigation.navigate("Direct");
    } else if (item.id === 5) {
      // Intrebari
      navigation.navigate("Intrebari");
    } else if (item.id === 6) {
      // Tehnici
      navigation.navigate("Tehnici");
    } else if (item.id === 7) {
      // Ajutor
      navigation.navigate("Ajutor");
    } else if (item.id === 8) {
      // Eu sunt Dan fost anxios
      navigation.navigate("AboutDan");
    } else if (item.id === 9) {
      // Subscriptions
      navigation.navigate("Subscriptions");
    } else if (item.id === 10) {
      navigation.navigate("IntelegeAnxietate");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Bine ai venit!</Text>
              <Text style={styles.userName}>În spațiul tău sigur</Text>
              {subType && (
                <View style={styles.subBadge}>
                  <Text style={styles.subBadgeText}>
                    {subType.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="leaf" size={26} color="#4a90e2" />
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Ce vrei să faci astăzi?</Text>

            {menuItems.map((item, index) => {
              const locked = isTrial && trialLockedIds.has(item.id);
              return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.lastMenuItem,
                  locked && styles.lockedMenuItem,
                ]}
                onPress={() => handleMenuPress(item)}
              >
                <View style={styles.menuItemCard}>
                  <View style={styles.menuItemContent}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: locked ? '#e8e8e8' : item.color + "18" },
                      ]}
                    >
                      <Ionicons
                        name={item.iconName}
                        size={26}
                        color={locked ? '#aaa' : item.color}
                      />
                    </View>

                    <View style={styles.textContainer}>
                      <Text style={[styles.menuItemTitle, locked && styles.lockedText]}>{item.title}</Text>
                      {locked ? (
                        <View style={styles.lockedRow}>
                          <Ionicons name="lock-closed" size={11} color="#bbb" />
                          <Text style={[styles.menuItemSubtitle, styles.lockedText]}> Disponibil cu abonament</Text>
                        </View>
                      ) : (
                        <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>

                    <View style={styles.arrowContainer}>
                      <Ionicons
                        name={locked ? "lock-closed" : "chevron-forward"}
                        size={18}
                        color={locked ? '#ccc' : '#b0c4d8'}
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>

          {/* External Links */}
          <View style={styles.externalLinks}>
            <TouchableOpacity
              style={styles.externalLinkBtn}
              onPress={() => Linking.openURL('https://www.facebook.com/groups/820094195023604/')}
            >
              <LinearGradient colors={['#1877F2', '#145dbf']} style={styles.externalLinkGradient}>
                <Ionicons name="people" size={20} color="#fff" style={styles.externalLinkIcon} />
                <Text style={styles.externalLinkText}>Comunitate</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.externalLinkBtn}
              onPress={() => Linking.openURL('https://danfostanxios.ro/testimoniale-2/')}
            >
              <LinearGradient colors={['#6cc04a', '#5aad3e']} style={styles.externalLinkGradient}>
                <Ionicons name="star" size={20} color="#fff" style={styles.externalLinkIcon} />
                <Text style={styles.externalLinkText}>Testimoniale Dan</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.termsButton}
              onPress={() => navigation.navigate("Terms")}
            >
              <Ionicons name="document-text-outline" size={18} color="#6c7b84" style={{ marginRight: 6 }} />
              <Text style={styles.termsText}>Termeni</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate("Settings")}
            >
              <Ionicons name="settings-outline" size={18} color="#6c7b84" style={{ marginRight: 6 }} />
              <Text style={styles.settingsText}>Setări</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={18} color="#d9534f" style={{ marginRight: 6 }} />
              <Text style={styles.logoutText}>Ieșire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ddeeff" },
  gradient: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    paddingTop: 10,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a2d45",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    color: "#6c8096",
    fontWeight: "400",
  },
  subBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#4a90e2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  subBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  logoContainer: {
    marginLeft: 15,
  },
  logoCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.75)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(74,144,226,0.15)",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  quoteSection: {
    marginBottom: 30,
  },
  quoteCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#4a90e2",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  quoteIcon: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#2c3e50",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 14,
    color: "#4a90e2",
    textAlign: "center",
    fontWeight: "600",
  },
  menuContainer: {
    marginBottom: 30,
  },
  menuTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8ca8c4",
    letterSpacing: 1.2,
    marginBottom: 14,
    marginLeft: 4,
  },
  menuItem: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: "hidden",
  },
  lastMenuItem: {
    marginBottom: 0,
  },
  lockedMenuItem: {
    opacity: 0.55,
  },
  lockedText: {
    color: '#999',
  },
  menuItemCard: {
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
    borderRadius: 18,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a2d45",
    marginBottom: 4,
    lineHeight: 22,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: "#6c8096",
    fontWeight: "400",
  },
  arrowContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 30,
  },

  externalLinks: {
    marginTop: 16,
    marginBottom: 8,
  },
  externalLinkBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  externalLinkGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  externalLinkIcon: {
    marginRight: 10,
  },
  externalLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(200,220,240,0.5)",
    marginTop: "auto",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
  },
  settingsText: {
    fontSize: 14, color: "#1a2d45", fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
  },
  logoutText: {
    fontSize: 14, color: "#d9534f", fontWeight: "500",
  },
  termsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
  },
  termsText: {
    fontSize: 13, color: "#6c8096", fontWeight: "500",
  },
});

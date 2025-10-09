import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  getSubscription,
  clearSubscription,
} from "../utils/subscriptionStorage";
import { clearToken } from "../utils/authStorage";
import { clearUser } from "../utils/userStorage";
import { clearEntries } from "../utils/progressStorage";
import { replaceAllRuns } from "../utils/challengeStorage";

const { width } = Dimensions.get("window");

export default function DashboardScreen({ navigation }) {
  const [subType, setSubType] = useState(null);
  useEffect(() => {
    (async () => {
      const sub = await getSubscription();
      if (sub && sub.type) setSubType(sub.type);
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await Promise.all([
        clearToken(),
        clearUser(),
        clearSubscription(),
        clearEntries(),
        replaceAllRuns([]),
      ]);
      setSubType(null);
    } catch (err) {
      console.log("Logout cleanup failed", err);
    } finally {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  }, [navigation]);
  const menuItems = [
    // 1) SOS first
    {
      id: 7,
      title: "Ajutor",
      subtitle: "Am nevoie acum",
      icon: "🆘",
      color: "#6cc04a",
    },
    // 2) Tehnici second
    {
      id: 6,
      title: "Tehnica HAI – metoda care elimină anxietatea",
      subtitle: "Descoperă pașii și aplicațiile",
      icon: "🧘",
      color: "#2bbbad",
    },
    // 3) About Dan
    {
      id: 8,
      title: "Eu sunt Dan fost anxios",
      subtitle: "Cunoaște-mă",
      icon: "�",
      color: "#9b59b6",
    },
    // Rest of items
    {
      id: 1,
      title: "Progresul meu",
      subtitle: "Urmărește-ți evoluția",
      icon: "📊",
      color: "#4a90e2",
    },
    {
      id: 2,
      title: "Gândul de azi de la Dan",
      subtitle: "Înțelepciune zilnică",
      icon: "�",
      color: "#5cb85c",
    },
    {
      id: 3,
      title: "Provocări",
      subtitle: "Depășește-ți limitele",
      icon: "🎯",
      color: "#f0ad4e",
    },
    {
      id: 4,
      title:
        "Intră în direct cu Dan sau trimite-i jurnalul lui Dan pentru analiza",
      subtitle: "Conectează-te direct",
      icon: "📹",
      color: "#d9534f",
    },
    {
      id: 5,
      title: "Trimite-mi o întrebare",
      subtitle: "Pune-ți întrebările",
      icon: "❓",
      color: "#5bc0de",
    },
    {
      id: 9,
      title: "Abonamente & Acces",
      subtitle: "Planuri Basic / Premium / VIP",
      icon: "💎",
      color: "#ff8c42",
    },
    {
      id: 10,
      title: "Înțelege anxietatea",
      subtitle: "Audio-uri și video explicative",
      icon: "🎧",
      color: "#8e44ad",
    },
  ];

  const handleMenuPress = (item) => {
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
    } else {
      console.log(`Pressed: ${item.title}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
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
                <Text style={styles.logoIcon}>🌿</Text>
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Ce vrei să faci astăzi?</Text>

            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.lastMenuItem,
                ]}
                onPress={() => handleMenuPress(item)}
              >
                <LinearGradient
                  colors={["#ffffff", "#f8fdff"]}
                  style={styles.menuItemGradient}
                >
                  <View style={styles.menuItemContent}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: item.color + "15" },
                      ]}
                    >
                      <Text style={styles.menuIcon}>{item.icon}</Text>
                    </View>

                    <View style={styles.textContainer}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <View style={styles.arrowContainer}>
                      <Text style={styles.arrow}>→</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙️</Text>
              <Text style={styles.settingsText}>Setări</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Ieșire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
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
    color: "#2c3e50",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    color: "#6c7b84",
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4a90e2",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 24,
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
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 20,
    textAlign: "center",
  },
  menuItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  lastMenuItem: {
    marginBottom: 0,
  },
  menuItemGradient: {
    shadowColor: "#4a90e2",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e8f4fd",
    borderRadius: 16,
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
  menuIcon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
    lineHeight: 22,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: "#6c7b84",
    fontWeight: "400",
  },
  arrowContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 30,
  },
  arrow: {
    fontSize: 18,
    color: "#4a90e2",
    fontWeight: "bold",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e8f4fd",
    marginTop: "auto",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#4a90e2",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  settingsIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  settingsText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#4a90e2",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  logoutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 14,
    color: "#d9534f",
    fontWeight: "500",
  },
});

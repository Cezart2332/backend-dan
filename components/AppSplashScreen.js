import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function AppSplashScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2300,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2300,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [pulse, drift]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.17],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.09],
  });

  const cardTranslate = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const glowOpacity = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.5],
  });

  return (
    <LinearGradient
      colors={["#e4efff", "#f2f8ff", "#eaf6ff"]}
      start={{ x: 0.1, y: 0.05 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="dark" />

      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY: cardTranslate }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />

        <View style={styles.iconShell}>
          <Ionicons name="sparkles-outline" size={30} color="#2468d0" />
        </View>

        <Text style={styles.title}>HAI ca poti</Text>
        <Text style={styles.subtitle}>
          Aplicatia unde il ai pe Dan la tine in buzunar
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(80, 144, 255, 0.18)",
  },
  orbTop: {
    width: width * 0.7,
    height: width * 0.7,
    top: -width * 0.28,
    right: -width * 0.2,
  },
  orbBottom: {
    width: width * 0.84,
    height: width * 0.84,
    bottom: -width * 0.5,
    left: -width * 0.34,
    backgroundColor: "rgba(62, 192, 255, 0.15)",
  },
  glow: {
    position: "absolute",
    width: Math.min(width * 0.66, 320),
    height: Math.min(width * 0.66, 320),
    borderRadius: 999,
    backgroundColor: "rgba(77, 149, 255, 0.26)",
    top: height * 0.26,
  },
  card: {
    width: Math.min(width - 42, 380),
    borderRadius: 28,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    shadowColor: "#2f6dd6",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 12,
  },
  ring: {
    position: "absolute",
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 2,
    borderColor: "rgba(36, 104, 208, 0.34)",
    top: 18,
  },
  iconShell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    backgroundColor: "rgba(251, 253, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(82, 142, 231, 0.28)",
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: "#1a3562",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#3d5d8a",
    textAlign: "center",
    maxWidth: 300,
  },
});

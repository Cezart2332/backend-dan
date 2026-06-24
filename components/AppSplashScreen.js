import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows } from "./ui";

const { width } = Dimensions.get("window");

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

  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0.1, y: 0.05 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="dark" />
      <View style={styles.backPlate} />

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
          <Ionicons name="leaf-outline" size={31} color={colors.primary} />
        </View>

        <Text style={styles.title}>HAI că poți</Text>
        <Text style={styles.subtitle}>
          Dan este cu tine când ai nevoie de un pas simplu.
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
  backPlate: {
    position: "absolute",
    width: Math.min(width - 48, 420),
    height: 220,
    borderRadius: radius.xl,
    backgroundColor: "rgba(47,115,216,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: "-4deg" }],
  },
  card: {
    width: Math.min(width - 42, 380),
    borderRadius: radius.xl,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  ring: {
    position: "absolute",
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 2,
    borderColor: "rgba(47,115,216,0.28)",
    top: 18,
  },
  iconShell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 300,
  },
});

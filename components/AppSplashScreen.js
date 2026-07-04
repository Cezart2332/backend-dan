import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { colors, fonts, gradients } from "./ui";

const { width } = Dimensions.get("window");
const MARK_WIDTH = Math.min(width * 0.58, 300);

export default function AppSplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;
  const lineGrow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(lineGrow, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  }, [fade, rise, lineGrow]);

  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0.1, y: 0.05 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="dark" />

      <Animated.View
        style={[
          styles.center,
          { opacity: fade, transform: [{ translateY: rise }] },
        ]}
      >
        <Animated.Image
          source={require("../assets/brandmark.png")}
          style={styles.mark}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: lineGrow }]}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>Liniște, pas cu pas</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_WIDTH * 0.835,
  },
  footer: {
    position: "absolute",
    bottom: 64,
    alignItems: "center",
  },
  footerLine: {
    width: 36,
    height: 1,
    backgroundColor: colors.textSoft,
    marginBottom: 12,
  },
  footerText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
});

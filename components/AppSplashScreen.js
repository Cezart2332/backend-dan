import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { colors, fonts, gradients } from "./ui";

const { width } = Dimensions.get("window");
const MARK_WIDTH = Math.min(width * 0.56, 290);
const RING_SIZE = MARK_WIDTH * 1.55;

function BreathRing({ delay, size }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 3600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1.28],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 0.45, 0.12, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function PulseDot({ pulse, index }) {
  const opacity = pulse.interpolate({
    inputRange: [index, index + 0.5, index + 1, 3],
    outputRange: [0.25, 1, 0.25, 0.25],
    extrapolate: "clamp",
  });
  return <Animated.View style={[styles.dot, { opacity }]} />;
}

export default function AppSplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const lineGrow = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(lineGrow, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(footerFade, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathLoop.start();

    const dotsLoop = Animated.loop(
      Animated.timing(dotPulse, {
        toValue: 3,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    dotsLoop.start();

    return () => {
      breathLoop.stop();
      dotsLoop.stop();
    };
  }, [fade, rise, scale, lineGrow, footerFade, breath, dotPulse]);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0.1, y: 0.05 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="dark" />

      <View style={styles.center}>
        <View style={styles.haloArea}>
          <BreathRing delay={0} size={RING_SIZE} />
          <BreathRing delay={1200} size={RING_SIZE} />
          <BreathRing delay={2400} size={RING_SIZE} />

          <Animated.View
            style={{
              opacity: fade,
              transform: [
                { translateY: rise },
                { scale: Animated.multiply(scale, breathScale) },
              ],
            }}
          >
            <Animated.Image
              source={require("../assets/brandmark.png")}
              style={styles.mark}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.goldLine,
            { opacity: lineGrow, transform: [{ scaleX: lineGrow }] },
          ]}
        />
      </View>

      <Animated.View style={[styles.footer, { opacity: footerFade }]}>
        <Text style={styles.footerText}>Liniște, pas cu pas</Text>
        <View style={styles.dots}>
          <PulseDot pulse={dotPulse} index={0} />
          <PulseDot pulse={dotPulse} index={1} />
          <PulseDot pulse={dotPulse} index={2} />
        </View>
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
  haloArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(179, 146, 79, 0.55)",
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_WIDTH * 0.835,
  },
  goldLine: {
    width: 52,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(179, 146, 79, 0.85)",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
  },
  footerText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  dots: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(179, 146, 79, 0.9)",
  },
});

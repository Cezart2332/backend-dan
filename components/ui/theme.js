import { Platform } from "react-native";

// Paletă derivată din logo: cerneală navy (#202F3E) pe ivory (#F3F3F3),
// monocromă și calmă, cu un singur accent cald (champagne) folosit rar.
export const colors = {
  background: "#f4f5f6",
  backgroundTop: "#f6f7f8",
  backgroundMid: "#f3f4f6",
  backgroundBottom: "#eef0f2",
  surface: "rgba(255,255,255,0.92)",
  surfaceStrong: "#ffffff",
  surfaceMuted: "rgba(243,244,246,0.9)",
  border: "rgba(32,47,62,0.1)",
  text: "#1c2b3a",
  textMuted: "#5b6a7a",
  textSoft: "#8a97a5",
  primary: "#24384e",
  primaryDark: "#16222f",
  primarySoft: "#e8ebef",
  accent: "#b3924f",
  success: "#3d7d5f",
  warning: "#b07e3e",
  danger: "#a8544c",
  violet: "#5c5a80",
  teal: "#3e7e76",
  white: "#ffffff",
  overlay: "rgba(16,25,35,0.5)",
};

export const gradients = {
  screen: [colors.backgroundTop, colors.backgroundMid, colors.backgroundBottom],
  primary: [colors.primary, colors.primaryDark],
  success: [colors.success, "#2f6349"],
};

// Serif elegant pentru titluri, ca wordmark-ul „Dan" din logo.
export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
};

export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const type = {
  // Etichetă cu majuscule spațiate, ca „FOST ANXIOS" din logo.
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  button: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
};

export const shadows = {
  card: {
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  button: {
    shadowColor: "#16222f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const tokens = { colors, gradients, fonts, radius, spacing, type, shadows };

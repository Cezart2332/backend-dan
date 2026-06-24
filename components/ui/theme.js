export const colors = {
  background: "#eef6ff",
  backgroundTop: "#dfeeff",
  backgroundMid: "#f4f9ff",
  backgroundBottom: "#edf8f4",
  surface: "rgba(255,255,255,0.86)",
  surfaceStrong: "rgba(255,255,255,0.94)",
  surfaceMuted: "rgba(239,247,255,0.88)",
  border: "rgba(117,154,194,0.18)",
  text: "#18324f",
  textMuted: "#58718e",
  textSoft: "#7d93aa",
  primary: "#2f73d8",
  primaryDark: "#2158ad",
  primarySoft: "#e2efff",
  success: "#3f9f64",
  warning: "#d88a28",
  danger: "#c94b4b",
  violet: "#6f67ff",
  teal: "#1f9d91",
  white: "#ffffff",
  overlay: "rgba(19,40,68,0.42)",
};

export const gradients = {
  screen: [colors.backgroundTop, colors.backgroundMid, colors.backgroundBottom],
  primary: [colors.primary, colors.primaryDark],
  success: [colors.success, "#2f7d4d"],
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
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  button: {
    fontSize: 15,
    fontWeight: "800",
  },
};

export const shadows = {
  card: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  button: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
};

export const tokens = { colors, gradients, radius, spacing, type, shadows };

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { colors, fonts, gradients, radius, shadows, spacing, type } from "./theme";
import { useTheme, useThemedStyles } from "./themeContext";

/**
 * Pressable cu animație de apăsare (scale + fade) — folosit de toate
 * elementele interactive pentru un feel viu, nu static.
 *
 * `style` se aplică pe view-ul interior (cel care se scalează la apăsare).
 * `containerStyle` se aplică pe Pressable-ul exterior — necesar pentru
 * proprietăți de layout flex (flex, flexShrink, maxWidth) atunci când
 * elementul stă într-un rând, altfel nu au efect.
 */
export function PressableScale({
  children,
  onPress,
  disabled = false,
  style,
  containerStyle,
  scaleTo = 0.97,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      style={containerStyle}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function AppScreen({ children, scroll = true, keyboard = false, contentStyle }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      {body}
    </KeyboardAvoidingView>
  ) : body;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={tc(gradients.screen, 'bg')} style={styles.flex}>
        {wrapped}
      </LinearGradient>
    </SafeAreaView>
  );
}

export function AppHeader({ title, subtitle, overline, icon, onBack, rightAction }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      {onBack ? (
        <PressableScale accessibilityRole="button" accessibilityLabel="Înapoi"
          onPress={onBack}
          style={styles.backButton}
          scaleTo={0.9}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={22} color={tc(colors.primary, 'fg')} />
        </PressableScale>
      ) : null}
      <View style={styles.headerText}>
        {icon ? (
          <View style={styles.headerIcon}>
            <Feather name={icon} size={22} color={tc(colors.primary, 'fg')} />
          </View>
        ) : null}
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
}

export function AppCard({ children, style, muted = false }) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, muted && styles.cardMuted, style]}>{children}</View>;
}

/**
 * Buton lean: solid = navy translucid; glass = alb translucid cu hairline;
 * ghost = doar contur. Etichetă cu majuscule spațiate.
 */
export function AppButton({
  title,
  icon,
  variant = "solid",
  loading = false,
  disabled = false,
  onPress,
  style,
}) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isSolid = variant === "solid" || variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const contentColor = tc(isSolid ? colors.white : isDanger ? colors.danger : colors.primary, 'fg');

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isSolid && styles.solidButton,
        isGhost && styles.ghostButton,
        !isSolid && !isGhost && styles.glassButton,
        isDanger && styles.dangerButton,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon ? (
            <Feather name={icon} size={17} color={contentColor} style={styles.buttonIcon} />
          ) : null}
          <Text style={[styles.buttonText, { color: contentColor }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

/**
 * Câmp de text lean: umplere translucidă, hairline, focus ring navy.
 */
export function AppTextField({ label, error, icon, style, inputStyle, ...props }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={focused ? tc(colors.primary, 'fg') : tc(colors.textSoft, 'fg')}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={tc(colors.textSoft, 'fg')}
          style={[styles.input, props.multiline && styles.multilineInput, inputStyle]}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function StateView({ icon = "feather", title, message, action }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <AppCard style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={22} color={tc(colors.primary, 'fg')} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {action}
    </AppCard>
  );
}

// Ionicons rămâne exportat pentru conținutul dinamic din CMS,
// care trimite nume de iconițe Ionicons.
export { Feather, Ionicons };

const createStyles = (tc) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: tc(colors.backgroundTop, 'bg') },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.22)", 'bg'),
    marginRight: spacing.md,
    zIndex: 10,
  },
  headerText: { flex: 1 },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(255,255,255,0.5)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.2)", 'bg'),
    marginBottom: spacing.sm,
  },
  overline: { ...type.overline, color: tc(type.overline.color, 'fg'), marginBottom: 4 },
  title: { ...type.title, color: tc(type.title.color, 'fg') },
  subtitle: { ...type.subtitle, color: tc(type.subtitle.color, 'fg'), marginTop: 3 },
  rightAction: { marginLeft: spacing.md },
  card: {
    backgroundColor: tc("rgba(255,255,255,0.62)", 'bg'),
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.2)", 'bg'),
    padding: spacing.lg,
  },
  cardMuted: { backgroundColor: tc("rgba(243,244,246,0.55)", 'bg') },
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  solidButton: {
    backgroundColor: tc("rgba(28,43,58,0.92)", 'bg'),
    ...shadows.button,
  },
  glassButton: {
    backgroundColor: tc("rgba(255,255,255,0.5)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.28)", 'bg'),
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: tc("rgba(32,47,62,0.24)", 'bg'),
  },
  dangerButton: {
    backgroundColor: tc("rgba(168,84,76,0.08)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(168,84,76,0.32)", 'bg'),
  },
  buttonIcon: { marginRight: spacing.sm },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  disabled: { opacity: 0.55 },
  field: { marginBottom: spacing.md },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: tc(colors.textMuted, 'fg'),
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.24)", 'bg'),
    backgroundColor: tc("rgba(255,255,255,0.5)", 'bg'),
    paddingHorizontal: spacing.lg,
  },
  inputWrapFocused: {
    borderWidth: 1,
    borderColor: tc(colors.primary, 'bg'),
    backgroundColor: tc("rgba(255,255,255,0.78)", 'bg'),
  },
  inputWrapError: {
    borderColor: tc(colors.danger, 'bg'),
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: tc(colors.text, 'fg'),
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 112,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  fieldError: {
    color: tc(colors.danger, 'fg'),
    fontSize: 12,
    marginTop: spacing.xs,
  },
  stateCard: { alignItems: "center", marginTop: spacing.xl },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc("rgba(255,255,255,0.55)", 'bg'),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc("rgba(32,47,62,0.2)", 'bg'),
    marginBottom: spacing.md,
  },
  stateTitle: { ...type.sectionTitle, color: tc(type.sectionTitle.color, 'fg'), textAlign: "center" },
  stateMessage: { ...type.body, color: tc(type.body.color, 'fg'), textAlign: "center", marginTop: spacing.xs },
});

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
      <LinearGradient colors={gradients.screen} style={styles.flex}>
        {wrapped}
      </LinearGradient>
    </SafeAreaView>
  );
}

export function AppHeader({ title, subtitle, overline, icon, onBack, rightAction }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <PressableScale
          onPress={onBack}
          style={styles.backButton}
          scaleTo={0.9}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={22} color={colors.primary} />
        </PressableScale>
      ) : null}
      <View style={styles.headerText}>
        {icon ? (
          <View style={styles.headerIcon}>
            <Feather name={icon} size={22} color={colors.primary} />
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
  const isSolid = variant === "solid" || variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const contentColor = isSolid ? colors.white : isDanger ? colors.danger : colors.primary;

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
            color={focused ? colors.primary : colors.textSoft}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textSoft}
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
  return (
    <AppCard style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={22} color={colors.primary} />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.backgroundTop },
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
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.22)",
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
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.2)",
    marginBottom: spacing.sm,
  },
  overline: { ...type.overline, marginBottom: 4 },
  title: type.title,
  subtitle: { ...type.subtitle, marginTop: 3 },
  rightAction: { marginLeft: spacing.md },
  card: {
    backgroundColor: "rgba(255,255,255,0.62)",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.2)",
    padding: spacing.lg,
  },
  cardMuted: { backgroundColor: "rgba(243,244,246,0.55)" },
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
    backgroundColor: "rgba(28,43,58,0.92)",
    ...shadows.button,
  },
  glassButton: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.28)",
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.24)",
  },
  dangerButton: {
    backgroundColor: "rgba(168,84,76,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(168,84,76,0.32)",
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
    color: colors.textMuted,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.24)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: spacing.lg,
  },
  inputWrapFocused: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  inputWrapError: {
    borderColor: colors.danger,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 112,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  fieldError: {
    color: colors.danger,
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
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,47,62,0.2)",
    marginBottom: spacing.md,
  },
  stateTitle: { ...type.sectionTitle, textAlign: "center" },
  stateMessage: { ...type.body, textAlign: "center", marginTop: spacing.xs },
});

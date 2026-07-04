import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, gradients, radius, shadows, spacing, type } from "./theme";

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
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.78}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerText}>
        {icon ? (
          <View style={styles.headerIcon}>
            <Ionicons name={icon} size={24} color={colors.primary} />
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

export function AppButton({
  title,
  icon,
  variant = "primary",
  loading = false,
  disabled = false,
  onPress,
  style,
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? colors.white : colors.primary} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={isPrimary || isDanger ? colors.white : colors.primary}
              style={styles.buttonIcon}
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              isPrimary && styles.primaryButtonText,
              isDanger && styles.dangerButtonText,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </>
  );

  return (
    <TouchableOpacity
      style={[styles.buttonWrap, disabled && styles.disabled, style]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled || loading}
    >
      {isPrimary ? (
        <LinearGradient colors={gradients.primary} style={styles.button}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, styles.secondaryButton, isDanger && styles.dangerButton]}>
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function AppTextField({ label, error, style, inputStyle, ...props }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSoft}
        style={[styles.input, props.multiline && styles.multilineInput, inputStyle]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function StateView({ icon = "leaf-outline", title, message, action }) {
  return (
    <AppCard style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {action}
    </AppCard>
  );
}

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
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
    zIndex: 10,
    ...shadows.card,
  },
  headerText: { flex: 1 },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  overline: { ...type.overline, marginBottom: 4 },
  title: type.title,
  subtitle: { ...type.subtitle, marginTop: 3 },
  rightAction: { marginLeft: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardMuted: { backgroundColor: colors.surfaceMuted },
  buttonWrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadows.button,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  secondaryButton: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerButton: {
    backgroundColor: "rgba(201,75,75,0.1)",
    borderColor: "rgba(201,75,75,0.22)",
  },
  buttonIcon: { marginRight: spacing.sm },
  buttonText: { ...type.button, color: colors.primary },
  primaryButtonText: { color: colors.white },
  dangerButtonText: { color: colors.danger },
  disabled: { opacity: 0.62 },
  field: { marginBottom: spacing.md },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    color: colors.text,
    paddingHorizontal: spacing.lg,
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
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.md,
  },
  stateTitle: { ...type.sectionTitle, textAlign: "center" },
  stateMessage: { ...type.body, textAlign: "center", marginTop: spacing.xs },
});

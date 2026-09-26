import * as Haptics from 'expo-haptics';

const IMPACT_STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFICATION_TYPES = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

// Vibrația e un bonus: pe dispozitive fără motor haptic (sau pe web) se ignoră.
export function hapticImpact(style = 'light') {
  Haptics.impactAsync(IMPACT_STYLES[style] || IMPACT_STYLES.light).catch(() => {});
}

export function hapticNotify(type = 'success') {
  Haptics.notificationAsync(NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.success).catch(() => {});
}

export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}

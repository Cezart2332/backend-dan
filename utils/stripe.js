import Constants from 'expo-constants';

// Access the publishable key exposed via app.json extra
export function getStripePublishableKey() {
  return Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

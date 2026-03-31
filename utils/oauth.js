import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { api } from './api';
import { saveToken } from './authStorage';
import { saveUser } from './userStorage';
import { saveSubscription } from './subscriptionStorage';

// Ensure the browser auth session completes properly on Android/iOS
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs
// Web client ID – used by expo-auth-session as the OAuth audience on all platforms
const GOOGLE_WEB_CLIENT_ID = '109371475889-q2keqvuk0ho5rqb1fqdtbh3fli03sc5u.apps.googleusercontent.com';
// Platform-specific client IDs created in Google Cloud Console
// Replace these with your actual iOS and Android client IDs:
const GOOGLE_IOS_CLIENT_ID = '109371475889-sdet3ch6r3lf1n2voto4cjfcggjhc84k.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '109371475889-eadfpt9ovu6bkur2scatm063ht6uvqrv.apps.googleusercontent.com';
const GOOGLE_NATIVE_REDIRECT_URI = 'danfostanxios:/oauthredirect';

/**
 * Hook for Google sign-in. Call this at the top level of a component.
 * Uses platform-specific client IDs for native builds and web client ID as fallback.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    // Helps account switching without stale Google session reuse.
    selectAccount: true,
  }, {
    // Force redirect URI that matches app.json scheme to avoid Android custom URI mismatches.
    native: GOOGLE_NATIVE_REDIRECT_URI,
    scheme: 'danfostanxios',
    path: 'oauthredirect',
  });

  return { request, response, promptAsync };
}

/**
 * Handle the Google auth response – send id_token to backend.
 * Returns { token, user } on success or throws on failure.
 */
export async function handleGoogleResponse(response) {
  if (response?.type !== 'success') {
    const oauthError =
      response?.params?.error_description ||
      response?.params?.error ||
      response?.error?.message;
    if (oauthError) {
      throw new Error(`Google OAuth: ${oauthError}`);
    }
    if (response?.type === 'cancel' || response?.type === 'dismiss') {
      throw new Error('Autentificarea Google a fost anulată');
    }
    throw new Error('Autentificare Google eșuată');
  }

  const idToken = response.params?.id_token;
  if (!idToken) {
    throw new Error('Nu s-a putut obține tokenul Google');
  }

  // Send id_token to our backend for verification + user creation/login
  const result = await api.oauthGoogle(idToken);
  if (result?.token) await saveToken(result.token);
  if (result?.user) await saveUser(result.user);

  // Fetch subscription info
  try {
    if (result?.token) {
      const subResp = await api.getCurrentSubscription(result.token);
      const subscriptionType = String(subResp?.subscription?.type || '').toLowerCase();
      const isBackendTrialActive = subResp?.status === 'active' && subscriptionType === 'trial';
      await saveSubscription({
        ...(subResp.subscription || {}),
        _status: isBackendTrialActive ? 'none' : subResp.status,
        _trialEligible: subResp.trialEligible,
      });
    }
  } catch {
    // Subscription fetch failed silently
  }

  return result;
}

/**
 * Sign in with Apple (iOS only).
 * Returns { token, user } on success or throws on failure.
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple este disponibil doar pe iOS');
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sign in with Apple nu este disponibil pe acest dispozitiv');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Nu s-a putut obține tokenul Apple');
  }

  // Build the user's name from Apple's response (only provided on first sign-in)
  let name = null;
  if (credential.fullName) {
    const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
    if (parts.length > 0) name = parts.join(' ');
  }

  // Send id_token + name to our backend
  const result = await api.oauthApple(credential.identityToken, name);
  if (result?.token) await saveToken(result.token);
  if (result?.user) await saveUser(result.user);

  // Fetch subscription info
  try {
    if (result?.token) {
      const subResp = await api.getCurrentSubscription(result.token);
      const subscriptionType = String(subResp?.subscription?.type || '').toLowerCase();
      const isBackendTrialActive = subResp?.status === 'active' && subscriptionType === 'trial';
      await saveSubscription({
        ...(subResp.subscription || {}),
        _status: isBackendTrialActive ? 'none' : subResp.status,
        _trialEligible: subResp.trialEligible,
      });
    }
  } catch {
    // Subscription fetch failed silently
  }

  return result;
}

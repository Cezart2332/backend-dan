import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { api } from './api';
import { saveToken } from './authStorage';
import { saveUser } from './userStorage';
import { saveSubscription } from './subscriptionStorage';

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = '109371475889-q2keqvuk0ho5rqb1fqdtbh3fli03sc5u.apps.googleusercontent.com';

/**
 * Hook for Google sign-in. Call this at the top level of a component.
 * Returns [request, response, promptAsync] from expo-auth-session.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    // For Android, use the same web client ID with expo-auth-session proxy
    // For iOS, use the same web client ID
  });

  return { request, response, promptAsync };
}

/**
 * Handle the Google auth response – send id_token to backend.
 * Returns { token, user } on success or throws on failure.
 */
export async function handleGoogleResponse(response) {
  if (response?.type !== 'success') {
    throw new Error('Autentificarea Google a fost anulată');
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
      await saveSubscription({
        ...(subResp.subscription || {}),
        _status: subResp.status,
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
      await saveSubscription({
        ...(subResp.subscription || {}),
        _status: subResp.status,
        _trialEligible: subResp.trialEligible,
      });
    }
  } catch {
    // Subscription fetch failed silently
  }

  return result;
}

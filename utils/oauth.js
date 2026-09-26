import { useCallback, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { api } from './api';
import { saveToken } from './authStorage';
import { saveUser } from './userStorage';
import { saveSubscription } from './subscriptionStorage';
import { reportError } from './monitoring';

// Ensure the browser auth session completes properly on Android/iOS
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs
// Web client ID – used by expo-auth-session as the OAuth audience on all platforms
const GOOGLE_WEB_CLIENT_ID = '109371475889-q2keqvuk0ho5rqb1fqdtbh3fli03sc5u.apps.googleusercontent.com';
// Platform-specific client IDs created in Google Cloud Console
const GOOGLE_IOS_CLIENT_ID = '109371475889-sdet3ch6r3lf1n2voto4cjfcggjhc84k.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '109371475889-eadfpt9ovu6bkur2scatm063ht6uvqrv.apps.googleusercontent.com';

const NATIVE_REQUEST = { native: true };
let nativeGoogleConfigured = false;

/**
 * Android: Google nu mai acceptă întoarcerea din browser printr-o schemă URI
 * proprie pentru clienții OAuth de tip Android (eroarea 400 invalid_request),
 * așa că folosim selectorul nativ de cont. Token-ul are ca audiență clientul
 * Web, pe care backend-ul îl acceptă deja.
 *
 * @returns {Promise<object|null>} răspuns în formatul expo-auth-session, sau null
 *   dacă o autentificare e deja în curs.
 */
async function signInWithGoogleNative() {
  const { GoogleSignin, isErrorWithCode, statusCodes } = require('@react-native-google-signin/google-signin');
  if (!nativeGoogleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    nativeGoogleConfigured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Fără sesiunea anterioară, utilizatorul își poate alege contul de fiecare dată.
    await GoogleSignin.signOut().catch(() => {});
    const result = await GoogleSignin.signIn();
    if (result?.type !== 'success') return { type: 'cancel' };
    return { type: 'success', params: { id_token: result.data?.idToken || null } };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { type: 'cancel' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { type: 'error', error: new Error('Serviciile Google Play nu sunt disponibile pe acest telefon.') };
      }
      // DEVELOPER_ERROR: amprenta SHA-1 a aplicației nu e înregistrată în Google Cloud.
      if (String(error.code) === '10' || error.code === 'DEVELOPER_ERROR') {
        reportError(error, { flow: 'google_sign_in_android', code: 'DEVELOPER_ERROR' });
        return { type: 'error', error: new Error('Configurarea Google pentru Android este incompletă (DEVELOPER_ERROR).') };
      }
    }
    reportError(error, { flow: 'google_sign_in_android' });
    return { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Hook for Google sign-in. Call this at the top level of a component.
 * iOS folosește fluxul expo-auth-session; Android folosește selectorul nativ.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    // Helps account switching without stale Google session reuse.
    selectAccount: true,
  });
  const [nativeResponse, setNativeResponse] = useState(null);

  const nativePromptAsync = useCallback(async () => {
    const result = await signInWithGoogleNative();
    if (result) setNativeResponse(result);
    return result;
  }, []);

  if (Platform.OS === 'android') {
    return { request: NATIVE_REQUEST, response: nativeResponse, promptAsync: nativePromptAsync };
  }
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

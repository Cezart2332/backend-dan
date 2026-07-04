import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { saveToken } from '../utils/authStorage';
import { saveUser } from '../utils/userStorage';
import { saveSubscription } from '../utils/subscriptionStorage';
import { useGoogleAuth, handleGoogleResponse, signInWithApple } from '../utils/oauth';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google OAuth hook
  const { request: googleRequest, response: googleResponse, promptAsync: googlePromptAsync } = useGoogleAuth();

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse) {
      handleGoogleLogin(googleResponse);
    }
  }, [googleResponse]);

  const handleGoogleLogin = async (response) => {
    try {
      setLoading(true);
      setError('');
      await handleGoogleResponse(response);
      if (typeof onAuthenticated === 'function') onAuthenticated();
      navigation.navigate('Dashboard');
    } catch (e) {
      setError(e.message || 'Autentificare Google eșuată');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithApple();
      if (typeof onAuthenticated === 'function') onAuthenticated();
      navigation.navigate('Dashboard');
    } catch (e) {
      if (e.code === 'ERR_CANCELED') return; // User cancelled
      setError(e.message || 'Autentificare Apple eșuată');
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Introdu email și parolă');
      return;
    }
    try {
      setLoading(true);
      const res = await api.login({ email, password });
      if (res?.token) await saveToken(res.token);
      if (res?.user) await saveUser(res.user);
      // Fetch subscription (trial or active) and persist
      try {
        if (res?.token) {
          const subResp = await api.getCurrentSubscription(res.token);
          const subscriptionType = String(subResp?.subscription?.type || '').toLowerCase();
          const isBackendTrialActive = subResp?.status === 'active' && subscriptionType === 'trial';
          await saveSubscription({
            ...(subResp.subscription || {}),
            _status: isBackendTrialActive ? 'none' : subResp.status,
            _trialEligible: subResp.trialEligible,
          });
        }
      } catch (e) {
        // Subscription fetch failed silently - not critical for login
      }
  if (typeof onAuthenticated === 'function') onAuthenticated();
  navigation.navigate('Dashboard');
    } catch (e) {
      setError(e.message || 'Autentificare eșuată');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f6f7f8', '#f3f4f6', '#eef0f2']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
            {/* Header */}
            <View style={styles.header}>
              <Image
                source={require('../assets/brandmark.png')}
                style={styles.brandmark}
                resizeMode="contain"
              />
              <Text style={styles.title}>Bine ai revenit</Text>
              <Text style={styles.subtitle}>Intră în spațiul tău de liniște</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#24384e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#8a97a5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#24384e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Parolă"
                  placeholderTextColor="#8a97a5"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#24384e"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Ai uitat parola?</Text>
              </TouchableOpacity>

              {error ? (<Text style={styles.errorText}>{error}</Text>) : null}
              <TouchableOpacity 
                style={[styles.loginButton, loading && { opacity: 0.7 }]}
                onPress={onLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#24384e', '#16222f']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.loginButtonText}>{loading ? 'Se conectează...' : 'Conectare'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>sau continuă cu</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialContainer}>
              <TouchableOpacity
                style={[styles.socialButton, loading && { opacity: 0.6 }]}
                onPress={() => googlePromptAsync()}
                disabled={!googleRequest || loading}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 8 }} />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialButton, loading && { opacity: 0.6 }]}
                  onPress={handleAppleLogin}
                  disabled={loading}
                >
                  <Ionicons name="logo-apple" size={20} color="#1c2b3a" style={{ marginRight: 8 }} />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Nu ai cont? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Creează cont</Text>
              </TouchableOpacity>
            </View>

            {/* Terms Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Terms')}
              style={styles.termsContainer}
            >
              <Text style={styles.termsText}>Termeni și Condiții</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  gradient: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  brandmark: {
    width: 190,
    height: 159,
    marginBottom: 18,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28, fontWeight: '700', letterSpacing: 0.2,
    color: '#1c2b3a',
    marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 16, color: '#5b6a7a',
    textAlign: 'center', fontWeight: '400',
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16, marginBottom: 16,
    paddingHorizontal: 16, paddingVertical: 4,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(32,47,62,0.18)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1, fontSize: 16, color: '#1c2b3a',
    paddingVertical: 16, fontWeight: '400',
  },
  eyeIcon: {
    padding: 4,
  },
  logoIcon: {
    fontSize: 40,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    textAlign: 'center',
    width: 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#24384e',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#24384e',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#a8544c',
    textAlign: 'center',
    marginBottom: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(32,47,62,0.22)',
  },
  dividerText: {
    marginHorizontal: 16, color: '#5b6a7a',
    fontSize: 14, fontWeight: '400',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 4,
    shadowColor: '#24384e',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#1c2b3a',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  registerText: {
    color: '#5b6a7a',
    fontSize: 15,
    fontWeight: '400',
  },
  registerLink: {
    color: '#24384e',
    fontSize: 15,
    fontWeight: '600',
  },
  termsContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 10,
  },
  termsText: {
    color: '#5b6a7a',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { saveToken } from '../utils/authStorage';
import { saveUser } from '../utils/userStorage';
import { saveSubscription } from '../utils/subscriptionStorage';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation, onAuthenticated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const onRegister = async () => {
    setError('');
    if (!email || !password || !fullName) {
      setError('Completează nume, email și parolă');
      return;
    }
    if (password !== confirmPassword) {
      setError('Parolele nu coincid');
      return;
    }
    try {
      setLoading(true);
      const res = await api.register({ email, password, name: fullName });
      if (res?.token) await saveToken(res.token);
      if (res?.user) await saveUser(res.user);
      try {
        if (res?.token) {
          const subResp = await api.getCurrentSubscription(res.token);
          await saveSubscription({
            ...(subResp.subscription || {}),
            _status: subResp.status,
            _trialEligible: subResp.trialEligible,
          });
        }
      } catch (err) {
        console.log('Subscription fetch failed', err?.message);
      }
      if (typeof onAuthenticated === 'function') onAuthenticated();
      // Show disclaimer modal before onboarding
      setShowDisclaimer(true);
    } catch (e) {
      setError(e.message || 'Eroare la înregistrare');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f0f8ff', '#e6f3ff', '#ffffff']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>

              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoIcon}>🌿</Text>
                </View>
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join your safe space today</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#a0c4e8"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#a0c4e8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#a0c4e8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={styles.eyeIconText}>
                    {showPassword ? "👁️" : "🙈"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#a0c4e8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={styles.eyeIconText}>
                    {showConfirmPassword ? "👁️" : "🙈"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.agreementContainer}>
                <Text style={styles.agreementText}>
                  By creating an account, you agree to our{' '}
                  <Text style={styles.linkText}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
              </View>

              {error ? (<Text style={styles.errorText}>{error}</Text>) : null}
              <TouchableOpacity 
                style={[styles.registerButton, loading && { opacity: 0.7 }]}
                onPress={onRegister}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#4a90e2', '#357abd']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.registerButtonText}>{loading ? 'Se creează...' : 'Create Account'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialContainer}>
              <TouchableOpacity style={styles.socialButton}>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButton}>
                <Text style={styles.socialIcon}>🍎</Text>
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButton}>
                <Text style={styles.socialIcon}>f</Text>
                <Text style={styles.socialButtonText}>Facebook</Text>
              </TouchableOpacity>
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      {showDisclaimer && (
        <View style={styles.disclaimerOverlay}>
          <View style={styles.disclaimerBox}>
            <ScrollView contentContainerStyle={styles.disclaimerScroll}>
              <Text style={styles.disclaimerTitle}>Disclaimer</Text>
              <Text style={styles.disclaimerText}>
Sunt coach și autor de cărți despre anxietate și am trecut personal prin această experiență, dar nu sunt specialist medical sau psiholog. Această aplicație oferă suport și resurse informative și nu înlocuiește sfatul unui medic sau psiholog. Dacă simptomele persistă sau se agravează, te rog să consulți un specialist.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.disclaimerButton}
              onPress={() => {
                setShowDisclaimer(false);
                navigation.navigate('Onboarding');
              }}
            >
              <LinearGradient colors={['#4a90e2', '#357abd']} style={styles.disclaimerButtonGrad}>
                <Text style={styles.disclaimerButtonText}>Am înțeles</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    marginBottom: 30,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#4a90e2',
    fontWeight: 'bold',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c7b84',
    textAlign: 'center',
    fontWeight: '400',
  },
  formContainer: {
    marginBottom: 25,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  inputIcon: {
    marginRight: 12,
    fontSize: 16,
    textAlign: 'center',
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    paddingVertical: 16,
    fontWeight: '400',
  },
  eyeIcon: {
    padding: 4,
  },
  eyeIconText: {
    fontSize: 16,
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
  agreementContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  agreementText: {
    fontSize: 13,
    color: '#6c7b84',
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '400',
  },
  linkText: {
    color: '#4a90e2',
    fontWeight: '500',
  },
  registerButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4a90e2',
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
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#d9534f',
    textAlign: 'center',
    marginBottom: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1e7f5',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6c7b84',
    fontSize: 14,
    fontWeight: '400',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
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
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 15,
  },
  loginText: {
    color: '#6c7b84',
    fontSize: 15,
    fontWeight: '400',
  },
  loginLink: {
    color: '#4a90e2',
    fontSize: 15,
    fontWeight: '600',
  },
  // Disclaimer modal styles
  disclaimerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disclaimerBox: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e6f3ff',
  },
  disclaimerScroll: {
    paddingBottom: 8,
  },
  disclaimerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2c3e50',
    textAlign: 'left',
  },
  disclaimerButton: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  disclaimerButtonGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  disclaimerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

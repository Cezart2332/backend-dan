import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { useTheme, useThemedStyles } from './ui/themeContext';

export default function ForgotPasswordScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const scrollRef = useRef(null);

  // Derulează formularul deasupra tastaturii; delay ca să apuce tastatura să apară.
  const scrollFieldIntoView = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  const handleSendEmail = async () => {
    setError('');
    const trimmedEmail = String(email || '').trim();
    if (!trimmedEmail) {
      setError('Introdu adresa de email.');
      return;
    }

    try {
      setLoading(true);
      await api.requestPasswordReset(trimmedEmail);
      setSent(true);
    } catch (e) {
      setError(e.message || 'Eroare. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');

    const trimmedCode = String(token || '').trim();
    const trimmedPassword = String(newPassword || '');
    const trimmedConfirm = String(confirmPassword || '');

    if (!trimmedCode) {
      setError('Introdu codul primit pe email.');
      return;
    }

    if (trimmedPassword.length < 8) {
      setError('Parola trebuie să aibă cel putin 8 caractere.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError('Parolele nu corespund.');
      return;
    }

    try {
      setLoading(true);
      await api.resetPassword({ newPassword: trimmedPassword, token: trimmedCode });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Resetarea a esuat. Verifica codul si încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.gradient}>
        <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoid}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>

            {done ? (
              <View style={styles.successCard}>
                <Feather name="check-circle" size={48} color={tc("#14b86e", 'fg')} />
                <Text style={styles.successTitle}>Parola resetata</Text>
                <Text style={styles.successText}>
                  Parola ta a fost actualizata cu succes. Te poti autentifica acum.
                </Text>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[tc('rgba(28,43,58,0.94)', 'bg'), tc('rgba(22,34,47,0.96)', 'bg')]} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Inapoi la autentificare</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : sent ? (
              <>
                <View style={styles.header}>
                  <View style={styles.iconCircle}>
                    <Feather name="key" size={36} color={tc("#24384e", 'fg')} />
                  </View>
                  <Text style={styles.title}>Codul de resetare</Text>
                  <Text style={styles.subtitle}>
                    Am trimis un cod la adresa {'\n'}
                    <Text style={{ fontWeight: '700', color: tc('#1c2b3a', 'fg') }}>{email.trim()}</Text>{'\n'}
                    Introdu codul primit si alege o noua parola.
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Feather name="key" size={20} color={tc("#24384e", 'fg')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Codul din email"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={tc("#24384e", 'fg')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Parola noua"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      onFocus={scrollFieldIntoView}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={tc("#24384e", 'fg')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirma parola noua"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      onFocus={scrollFieldIntoView}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={tc("#24384e", 'fg')}
                      />
                    </TouchableOpacity>
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={handleReset}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[tc('rgba(28,43,58,0.94)', 'bg'), tc('rgba(22,34,47,0.96)', 'bg')]} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color={tc("#fff", 'fg')} />
                      ) : (
                        <Text style={styles.buttonText}>Reseteaza parola</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.iconCircle}>
                    <Feather name="unlock" size={36} color={tc("#24384e", 'fg')} />
                  </View>
                  <Text style={styles.title}>Ai uitat parola?</Text>
                  <Text style={styles.subtitle}>
                    Introdu adresa de email si iti vom trimite un cod de resetare.
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Feather name="mail" size={20} color={tc("#24384e", 'fg')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Adresa de email"
                      placeholderTextColor={tc("#8a97a5", 'fg')}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={handleSendEmail}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[tc('rgba(28,43,58,0.94)', 'bg'), tc('rgba(22,34,47,0.96)', 'bg')]} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color={tc("#fff", 'fg')} />
                      ) : (
                        <Text style={styles.buttonText}>Trimite codul de resetare</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  gradient: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    marginBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    marginBottom: 20,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 24, fontWeight: '700', color: tc('#1c2b3a', 'fg'), textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: tc('#5b6a7a', 'fg'), textAlign: 'center', lineHeight: 22 },
  formContainer: { marginTop: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('rgba(255,255,255,0.45)', 'bg'),
    borderRadius: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: tc('rgba(32,47,62,0.28)', 'bg'),
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: tc('#1c2b3a', 'fg'), paddingVertical: 16, fontWeight: '400' },
  eyeIcon: { padding: 4 },
  errorText: { color: tc('#a8544c', 'fg'), textAlign: 'center', marginBottom: 12, fontSize: 14 },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  buttonText: { color: tc('#fff', 'fg'), fontSize: 13, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  successCard: { alignItems: 'center', marginTop: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 15, color: tc('#5b6a7a', 'fg'), textAlign: 'center', lineHeight: 22, marginBottom: 28 },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

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
      <LinearGradient colors={['#f6f7f8', '#f3f4f6', '#eef0f2']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>

            {done ? (
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#14b86e" />
                <Text style={styles.successTitle}>Parola resetata</Text>
                <Text style={styles.successText}>
                  Parola ta a fost actualizata cu succes. Te poti autentifica acum.
                </Text>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#24384e', '#16222f']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Inapoi la autentificare</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : sent ? (
              <>
                <View style={styles.header}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="key-outline" size={36} color="#24384e" />
                  </View>
                  <Text style={styles.title}>Codul de resetare</Text>
                  <Text style={styles.subtitle}>
                    Am trimis un cod la adresa {'\n'}
                    <Text style={{ fontWeight: '700', color: '#1c2b3a' }}>{email.trim()}</Text>{'\n'}
                    Introdu codul primit si alege o noua parola.
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={20} color="#24384e" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Codul din email"
                      placeholderTextColor="#8a97a5"
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#24384e" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Parola noua"
                      placeholderTextColor="#8a97a5"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#24384e" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirma parola noua"
                      placeholderTextColor="#8a97a5"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#24384e"
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
                    <LinearGradient colors={['#24384e', '#16222f']} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
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
                    <Ionicons name="lock-open-outline" size={36} color="#24384e" />
                  </View>
                  <Text style={styles.title}>Ai uitat parola?</Text>
                  <Text style={styles.subtitle}>
                    Introdu adresa de email si iti vom trimite un cod de resetare.
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#24384e" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Adresa de email"
                      placeholderTextColor="#8a97a5"
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
                    <LinearGradient colors={['#24384e', '#16222f']} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f8' },
  gradient: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    marginBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    marginBottom: 20,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 24, fontWeight: '700', color: '#1c2b3a', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#5b6a7a', textAlign: 'center', lineHeight: 22 },
  formContainer: { marginTop: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1c2b3a', paddingVertical: 16, fontWeight: '400' },
  eyeIcon: { padding: 4 },
  errorText: { color: '#a8544c', textAlign: 'center', marginBottom: 12, fontSize: 14 },
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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successCard: { alignItems: 'center', marginTop: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#1c2b3a', marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 15, color: '#5b6a7a', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
});

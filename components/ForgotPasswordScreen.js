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

  const handleSubmit = async () => {
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
      setError(e.message || 'Eroare. Incearca din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-open-outline" size={36} color="#4a90e2" />
              </View>
              <Text style={styles.title}>Ai uitat parola?</Text>
              <Text style={styles.subtitle}>
                Introdu adresa de email si iti vom trimite un link de resetare a parolei.
              </Text>
            </View>

            {sent ? (
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#14b86e" />
                <Text style={styles.successTitle}>Email trimis</Text>
                <Text style={styles.successText}>
                  Daca exista un cont cu aceasta adresa de email, vei primi un link de resetare in cateva minute.{'\n\n'}
                  Verifica si folderul de spam.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#4a90e2', '#357abd']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Inapoi la autentificare</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#4a90e2" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Adresa de email"
                    placeholderTextColor="#a0c4e8"
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
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#4a90e2', '#357abd']} style={styles.buttonGradient}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Trimite link-ul de resetare</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  gradient: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    marginBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    marginBottom: 20,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1a2d45', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6c8096', textAlign: 'center', lineHeight: 22 },
  formContainer: { marginTop: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,220,240,0.6)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1a2d45', paddingVertical: 16, fontWeight: '400' },
  errorText: { color: '#d9534f', textAlign: 'center', marginBottom: 12, fontSize: 14 },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successCard: { alignItems: 'center', marginTop: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#1a2d45', marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 15, color: '#6c8096', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  backToLoginBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});

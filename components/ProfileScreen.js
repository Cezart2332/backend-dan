import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, toAbsoluteApiUrl } from '../utils/api';
import { getToken } from '../utils/authStorage';
import { getUser, saveUser } from '../utils/userStorage';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

function estimateBase64Bytes(base64Payload) {
  const normalized = String(base64Payload || '').replace(/\s+/g, '');
  if (!normalized.length) return 0;

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function normalizeName(value) {
  return String(value || '').trim();
}

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState(null);
  const [previewAvatarUri, setPreviewAvatarUri] = useState(null);
  const [pendingAvatarBase64, setPendingAvatarBase64] = useState(null);
  const [pendingAvatarMimeType, setPendingAvatarMimeType] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const localUser = await getUser();
      if (localUser) {
        setName(normalizeName(localUser.name));
        setRemoteAvatarUrl(localUser.avatar_url || null);
      }

      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.getProfile(token);
      const user = response?.user || null;
      if (!user) {
        setLoading(false);
        return;
      }

      const resolvedName = normalizeName(user.name);
      setName(resolvedName);
      setRemoteAvatarUrl(user.avatar_url || null);
      setPreviewAvatarUri(null);
      setPendingAvatarBase64(null);
      setPendingAvatarMimeType(null);
      setRemoveAvatar(false);

      await saveUser({
        ...(localUser || {}),
        ...user,
        name: resolvedName,
      });
    } catch (error) {
      Alert.alert('Eroare', String(error?.message || 'Nu am putut incarca profilul.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile().catch(() => {
      setLoading(false);
    });
  }, [loadProfile]);

  const displayedAvatarUri = useMemo(() => {
    if (previewAvatarUri) return previewAvatarUri;
    return toAbsoluteApiUrl(remoteAvatarUrl);
  }, [previewAvatarUri, remoteAvatarUrl]);

  const handlePickAvatar = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Permisiune necesara', 'Permite accesul la galerie pentru a selecta o poza de profil.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });

      if (result?.canceled) return;

      const asset = Array.isArray(result?.assets) ? result.assets[0] : null;
      if (!asset || typeof asset.base64 !== 'string' || !asset.base64.length) {
        Alert.alert('Imagine invalida', 'Nu am putut procesa imaginea selectata.');
        return;
      }

      const estimatedBytes = estimateBase64Bytes(asset.base64);
      if (estimatedBytes > MAX_AVATAR_BYTES) {
        Alert.alert('Imagine prea mare', 'Avatarul trebuie sa aiba maximum 3MB.');
        return;
      }

      setPreviewAvatarUri(asset.uri || null);
      setPendingAvatarBase64(asset.base64);
      setPendingAvatarMimeType(asset.mimeType || 'image/jpeg');
      setRemoveAvatar(false);
    } catch (error) {
      Alert.alert('Eroare', String(error?.message || 'Nu am putut selecta imaginea.'));
    }
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    setPreviewAvatarUri(null);
    setPendingAvatarBase64(null);
    setPendingAvatarMimeType(null);
    setRemoveAvatar(true);
    setRemoteAvatarUrl(null);
  }, []);

  const handleSave = useCallback(async () => {
    const nextName = normalizeName(name);
    if (nextName.length < 2 || nextName.length > 60) {
      Alert.alert('Nume invalid', 'Numele trebuie sa aiba intre 2 si 60 de caractere.');
      return;
    }

    const token = await getToken();
    if (!token) {
      Alert.alert('Eroare', 'Sesiunea a expirat. Te rugam sa te autentifici din nou.');
      return;
    }

    const payload = { name: nextName };
    if (pendingAvatarBase64) {
      payload.avatarBase64 = pendingAvatarBase64;
      payload.avatarMimeType = pendingAvatarMimeType || 'image/jpeg';
    }
    if (removeAvatar && !pendingAvatarBase64) {
      payload.removeAvatar = true;
    }

    setSaving(true);
    try {
      const response = await api.updateProfile(payload, token);
      const updatedUser = response?.user || null;

      if (!updatedUser) {
        throw new Error('Raspuns invalid de la server');
      }

      const localUser = await getUser();
      const resolvedName = normalizeName(updatedUser.name);

      await saveUser({
        ...(localUser || {}),
        ...updatedUser,
        name: resolvedName,
      });

      setName(resolvedName);
      setRemoteAvatarUrl(updatedUser.avatar_url || null);
      setPreviewAvatarUri(null);
      setPendingAvatarBase64(null);
      setPendingAvatarMimeType(null);
      setRemoveAvatar(false);

      Alert.alert('Profil actualizat', 'Datele tale au fost salvate cu succes.');
    } catch (error) {
      Alert.alert('Eroare', String(error?.message || 'Nu am putut actualiza profilul.'));
    } finally {
      setSaving(false);
    }
  }, [name, pendingAvatarBase64, pendingAvatarMimeType, removeAvatar]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#ddeeff', '#eaf4ff', '#f5f9ff']} style={styles.gradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#4a90e2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profilul meu</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loaderText}>Se incarca profilul...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.contentWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarTapArea}>
                {displayedAvatarUri ? (
                  <Image source={{ uri: displayedAvatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={38} color="#4a90e2" />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>Apasa pe avatar pentru a schimba poza</Text>

              {displayedAvatarUri ? (
                <TouchableOpacity style={styles.removeAvatarBtn} onPress={handleRemoveAvatar}>
                  <Ionicons name="trash-outline" size={14} color="#b54f5b" />
                  <Text style={styles.removeAvatarText}>Sterge poza</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Nume afisat</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Numele tau"
                placeholderTextColor="#90a2b4"
                maxLength={60}
                autoCapitalize="words"
              />
              <Text style={styles.helperText}>Numele apare in comunitate si in chat.</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Salveaza profilul</Text>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  gradient: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2d45',
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 8,
    color: '#4a90e2',
  },
  contentWrap: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarTapArea: {
    width: 110,
    height: 110,
    borderRadius: 55,
    position: 'relative',
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(74,144,226,0.25)',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74,144,226,0.22)',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  avatarHint: {
    marginTop: 8,
    color: '#6c8096',
    fontSize: 12,
  },
  removeAvatarBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(181,79,91,0.25)',
    backgroundColor: 'rgba(181,79,91,0.08)',
  },
  removeAvatarText: {
    marginLeft: 6,
    color: '#b54f5b',
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(180,205,230,0.65)',
    padding: 14,
  },
  label: {
    color: '#4a6078',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(180,205,230,0.8)',
    color: '#1a2d45',
    fontSize: 15,
  },
  helperText: {
    marginTop: 8,
    color: '#6f859d',
    fontSize: 12,
  },
  saveBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.75,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
});

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppButton, AppHeader, AppScreen } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import ActivityStats from './ActivityStats';
import { api, toAbsoluteApiUrl } from '../utils/api';
import { getToken } from '../utils/authStorage';

export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { tc } = useTheme(), styles = useThemedStyles(createStyles);
  const [profile,setProfile] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [loading,setLoading] = useState(true);
  const [confirmation,setConfirmation] = useState(null);
  const load = useCallback(async () => { const token = await getToken(); return api.getSocialProfile(userId,token); }, [userId]);
  useFocusEffect(useCallback(() => { let active = true; load().then((data) => { if (active) { setProfile(data); setError(''); } }).catch((e) => { if (active) { setError(e.message); if ([401,403,404].includes(e.status)) setProfile(null); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]));
  const action = async (kind) => {
    if (busy) return; setBusy(true); setError('');
    try { await api.friendAction(userId,kind,await getToken()); setProfile(await load()); setConfirmation(null); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const block = async () => { setBusy(true); try { await api.blockPerson(userId,await getToken()); navigation.goBack(); } catch (e) { setError(e.message); setBusy(false); } };
  return <AppScreen><AppHeader title="Profil din comunitate" onBack={() => navigation.goBack()} />
    {loading ? <ActivityIndicator color={tc(colors.primary,'fg')} /> : null}
    {error ? <><Text style={styles.error} accessibilityRole="alert">{error}</Text><AppButton title="Reîncearcă" onPress={async () => { setLoading(true); try { setProfile(await load()); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } }} /></> : null}
    {profile ? <>
      <View style={styles.identity}>{profile.user.avatar_url ? <Image source={{ uri: toAbsoluteApiUrl(profile.user.avatar_url) }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(profile.user.name || 'M')[0]}</Text></View>}<Text style={styles.name}>{profile.user.name || 'Membru'}</Text><Text style={styles.caption}>{profile.relationship === 'friend' ? 'Sunteți prieteni' : 'Din comunitatea Dan fost anxios'}</Text></View>
      {profile.relationship === 'none' ? <AppButton title="Adaugă la prieteni" icon="user-plus" disabled={busy} onPress={() => action('request')} /> : null}
      {profile.relationship === 'incoming' ? <><AppButton title="Acceptă cererea" icon="check" disabled={busy} onPress={() => action('accept')} /><AppButton title="Refuză cererea" variant="ghost" disabled={busy} onPress={() => action('remove')} /></> : null}
      {profile.relationship === 'outgoing' ? <AppButton title="Anulează cererea trimisă" variant="ghost" disabled={busy} onPress={() => action('remove')} /> : null}
      {profile.relationship === 'friend' ? <><AppButton title="Trimite un mesaj privat" icon="message-circle" onPress={() => navigation.navigate('PrivateChat',{ userId, name: profile.user.name })} /><AppButton title="Elimină prietenia" variant="ghost" style={{ marginTop: 12 }} disabled={busy} onPress={() => setConfirmation('remove')} /></> : null}
      <Text style={styles.section} accessibilityRole="header">Activitate împărtășită</Text><ActivityStats stats={profile.stats} unavailable="Această persoană a ales să păstreze statisticile private." />
      <Text style={styles.caption}>Aici apar doar statistici de activitate. Însemnările și starea personală nu sunt afișate.</Text>
      {profile.relationship !== 'self' ? <AppButton title="Blochează persoana" variant="ghost" disabled={busy} onPress={() => setConfirmation('block')} /> : <AppButton title="Editează profilul meu" onPress={() => navigation.navigate('Profile')} />}
      {confirmation ? <View style={styles.confirmation}><Text style={styles.caption}>{confirmation === 'block' ? 'Blocarea oprește cererile și chatul privat cu această persoană. O poți debloca din lista de prieteni.' : 'Eliminarea prieteniei oprește chatul privat. Istoricul se păstrează în cont.'}</Text><AppButton title={confirmation === 'block' ? 'Confirmă blocarea' : 'Confirmă eliminarea'} loading={busy} onPress={() => confirmation === 'block' ? block() : action('remove')} /><AppButton title="Renunță" variant="ghost" disabled={busy} onPress={() => setConfirmation(null)} /></View> : null}
    </> : null}
  </AppScreen>;
}
const createStyles = (tc) => StyleSheet.create({
  identity: { alignItems: 'center', marginVertical: 25 }, avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: tc(colors.primarySoft,'bg'), alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 35, color: tc(colors.primary,'fg') }, name: { fontFamily: fonts.display, fontSize: 29, lineHeight: 36, color: tc(colors.text,'fg'), marginTop: 16 },
  confirmation: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: tc(colors.primarySoft,'bg') },
  caption: { fontSize: 12, lineHeight: 20, color: tc(colors.textMuted,'fg'), marginVertical: 10 }, section: { fontSize: 23, lineHeight: 30, fontFamily: fonts.display, color: tc(colors.text,'fg'), marginTop: 25, marginBottom: 16 }, error: { fontSize: 13, lineHeight: 21, color: tc(colors.danger,'fg') },
});

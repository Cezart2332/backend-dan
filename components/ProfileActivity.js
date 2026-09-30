import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppButton } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import Illustration from './Illustration';
import ActivityStats from './ActivityStats';
import { loadActivityStats } from '../utils/audioActivity';
import { getUser } from '../utils/userStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';

export default function ProfileActivity({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [data,setData] = useState(null), [share,setShare] = useState(null), [loading,setLoading] = useState(true), [saving,setSaving] = useState(false), [error,setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const [activity,user,token] = await Promise.all([loadActivityStats(),getUser(),getToken()]);
      if (active) { setData(activity); setLoading(false); }
      if (!user?.id || !token) return;
      try { const profile = await api.getSocialProfile(user.id,token); if (active) setShare(profile.shareActivity); }
      catch { if (active) setShare(null); }
    })().catch(() => { if (active) { setLoading(false); setError('Statisticile sunt indisponibile momentan.'); } });
    return () => { active = false; };
  }, []));
  const toggle = async (value) => {
    setSaving(true); setError('');
    try { const token = await getToken(); await api.saveSocialPreferences(value,token); setShare(value); }
    catch { setError('Preferința nu s-a putut salva. Încearcă din nou.'); }
    finally { setSaving(false); }
  };
  return <View style={styles.section}>
    <View style={styles.heading}><View style={styles.copy}><Text style={styles.title} accessibilityRole="header">Timp oferit ție</Text><Text style={styles.caption}>Activitatea ta de până acum</Text></View><Illustration kind="journey" size={72} /></View>
    {loading ? <ActivityIndicator color={tc(colors.primary,'fg')} /> : <ActivityStats stats={data?.stats} />}
    {data?.offline ? <Text style={styles.caption}>{data.pending ? 'Există ascultări salvate pe telefon, în așteptarea sincronizării.' : 'Ultimele statistici salvate pe telefon.'}</Text> : null}
    <Text style={styles.caption}>Audio-urile sunt numărate după parcurgerea a cel puțin 90% și încheierea redării. Provocările apar după trimiterea feedback-ului.</Text>
    <AppButton title="Prieteni și mesaje" icon="users" onPress={() => navigation.navigate('Friends')} />
    <AppButton title="Ascultă audio-urile" icon="headphones" variant="ghost" style={{ marginTop: 12 }} onPress={() => navigation.navigate('AudioAnxietateList')} />
    <View style={styles.sharing}><View style={styles.copy}><Text style={styles.sharingTitle}>Statistici pe profilul public</Text><Text style={styles.caption}>{share == null ? 'Disponibil după conectarea la server.' : 'Doar activitatea audio și provocările. Jurnalul și check-in-urile rămân private.'}</Text></View><Switch accessibilityLabel="Arată statisticile pe profilul public" value={Boolean(share)} disabled={share == null || saving} onValueChange={toggle} trackColor={{ false: tc(colors.primarySoft,'bg'), true: tc(colors.primary,'bg') }} /></View>
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </View>;
}
const createStyles = (tc) => StyleSheet.create({
  section: { marginBottom: 25 },
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, lineHeight: 31, fontFamily: fonts.display, color: tc(colors.text,'fg') },
  caption: { fontSize: 12, lineHeight: 19, color: tc(colors.textMuted,'fg'), marginVertical: 8 },
  sharing: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  sharingTitle: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: tc(colors.text,'fg') },
  error: { fontSize: 13, lineHeight: 20, color: tc(colors.danger,'fg') },
});

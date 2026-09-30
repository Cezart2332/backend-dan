import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppButton, AppHeader, AppScreen, AppTextField, PressableScale } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import Illustration from './Illustration';
import { api, toAbsoluteApiUrl } from '../utils/api';
import { getToken } from '../utils/authStorage';

export default function FriendsScreen({ navigation }) {
  const { tc } = useTheme(), styles = useThemedStyles(createStyles);
  const [friends,setFriends] = useState([]), [loading,setLoading] = useState(true), [next,setNext] = useState(null), [error,setError] = useState('');
  const [query,setQuery] = useState(''), [results,setResults] = useState([]), [searchNext,setSearchNext] = useState(null), [searching,setSearching] = useState(false), [searched,setSearched] = useState(false);
  const [busy,setBusy] = useState(null), [blocks,setBlocks] = useState(null), [blockNext,setBlockNext] = useState(null);
  const searchVersion = useRef(0);
  const tokenRef = useRef(null);
  const live = useRef(false);
  const refresh = useCallback(async (after) => {
    try { const token = await getToken(); tokenRef.current = token; const data = await api.getFriends(token,after); if (!live.current) return; setFriends((old) => after ? [...old,...data.items] : data.items); setNext(data.next); setError(''); }
    catch (e) { if (live.current) setError(e.message || 'Prietenii nu s-au putut încărca.'); }
    finally { if (live.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { live.current = true; refresh(); return () => { live.current = false; searchVersion.current++; }; }, [refresh]));
  const act = async (person,action) => {
    setBusy(person.id);
    try { await api.friendAction(person.id,action,tokenRef.current); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const search = async (after) => {
    const version = ++searchVersion.current; setSearching(true); setError('');
    try { const token = await getToken(); const data = await api.searchPeople(query.trim(),token,after); if (version !== searchVersion.current || !live.current) return; setResults((old) => after ? [...old,...data.items] : data.items); setSearchNext(data.next); setSearched(true); }
    catch (e) { if (version === searchVersion.current) setError(e.message); }
    finally { if (version === searchVersion.current) setSearching(false); }
  };
  const loadBlocks = async (after) => {
    try { const token = await getToken(); const data = await api.getBlockedPeople(token,after); setBlocks((old) => after ? [...old,...data.items] : data.items); setBlockNext(data.next); }
    catch (e) { setError(e.message); }
  };
  const person = (item,relationship = item.relationship) => <View key={item.id} style={styles.person}>
    <PressableScale disabled={relationship === 'blocked'} onPress={() => navigation.navigate('PublicProfile',{ userId: item.id })} style={styles.personMain} containerStyle={styles.flex} accessibilityRole="button" accessibilityLabel={`Profilul lui ${item.name || 'Membru'}`}>
      {item.avatar_url ? <Image source={{ uri: toAbsoluteApiUrl(item.avatar_url) }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(item.name || 'M')[0]}</Text></View>}
      <View style={styles.flex}><Text style={styles.name}>{item.name || 'Membru'}</Text><Text style={styles.caption}>{relationship === 'incoming' ? 'Ți-a trimis o cerere' : relationship === 'outgoing' ? 'Cerere trimisă' : item.unreadCount ? `${item.unreadCount} mesaje necitite` : 'Vezi profilul'}</Text></View>
    </PressableScale>
    {relationship === 'friend' ? <AppButton title="Mesaj" icon="message-circle" variant="ghost" onPress={() => navigation.navigate('PrivateChat',{ userId: item.id, name: item.name })} /> : null}
    {relationship === 'incoming' ? <View style={{ gap: 8 }}><AppButton title="Acceptă" disabled={busy === item.id} onPress={() => act(item,'accept')} /><AppButton title="Refuză" variant="ghost" disabled={busy === item.id} onPress={() => act(item,'remove')} /></View> : null}
    {relationship === 'outgoing' ? <AppButton title="Anulează" variant="ghost" disabled={busy === item.id} onPress={() => act(item,'remove')} /> : null}
    {relationship === 'blocked' ? <AppButton title="Deblochează" variant="ghost" disabled={busy === item.id} onPress={async () => { setBusy(item.id); try { await api.unblockPerson(item.id,await getToken()); await loadBlocks(); } catch (e) { setError(e.message); } finally { setBusy(null); } }} /> : null}
  </View>;
  return <AppScreen>
    <AppHeader title="Prieteni și mesaje" onBack={() => navigation.goBack()} />
    <View style={styles.intro}><View style={styles.flex}><Text style={styles.heading}>Mai aproape,{ '\n' }în ritmul tău.</Text><Text style={styles.caption}>Chatul privat se deschide după acceptarea cererii de prietenie.</Text></View><Illustration kind="friends" size={112} /></View>
    <AppTextField label="Caută o persoană după nume" value={query} onChangeText={(text) => { searchVersion.current++; setQuery(text); setResults([]); setSearched(false); setSearching(false); setSearchNext(null); }} maxLength={60} onSubmitEditing={() => search()} />
    <AppButton title="Caută persoane" icon="search" loading={searching} disabled={query.trim().length < 2} onPress={() => search()} />
    {error ? <View><Text style={styles.error} accessibilityRole="alert">{error}</Text><AppButton title="Reîncarcă prietenii" variant="ghost" onPress={() => refresh()} /></View> : null}
    {searched ? <><Text style={styles.section} accessibilityRole="header">Rezultatele căutării</Text>{results.map((item) => person(item,'none'))}{!results.length ? <Text style={styles.caption}>Nu am găsit persoane cu acest nume.</Text> : null}{searchNext ? <AppButton title="Mai multe rezultate" variant="ghost" onPress={() => search(searchNext)} /> : null}</> : null}
    {loading ? <ActivityIndicator color={tc(colors.primary,'fg')} /> : <>
      {friends.some((item) => item.relationship === 'incoming') ? <><Text style={styles.section} accessibilityRole="header">Cereri primite</Text>{friends.filter((item) => item.relationship === 'incoming').map((item) => person(item))}</> : null}
      <Text style={styles.section} accessibilityRole="header">Prietenii tăi</Text>
      {friends.filter((item) => item.relationship === 'friend').map((item) => person(item))}
      {!friends.some((item) => item.relationship === 'friend') ? <Text style={styles.caption}>Poți deschide profilul unei persoane din comunitate sau o poți căuta după nume.</Text> : null}
      {friends.some((item) => item.relationship === 'outgoing') ? <><Text style={styles.section} accessibilityRole="header">Cereri trimise</Text>{friends.filter((item) => item.relationship === 'outgoing').map((item) => person(item))}</> : null}
      {next ? <AppButton title="Încarcă mai multe persoane" variant="ghost" onPress={() => refresh(next)} /> : null}
    </>}
    <AppButton title="Persoane blocate" variant="ghost" onPress={() => blocks == null ? loadBlocks() : setBlocks(null)} />
    {blocks ? <>{blocks.map((item) => person(item,'blocked'))}{!blocks.length ? <Text style={styles.caption}>Nu ai persoane blocate.</Text> : null}{blockNext ? <AppButton title="Mai multe persoane blocate" variant="ghost" onPress={() => loadBlocks(blockNext)} /> : null}</> : null}
  </AppScreen>;
}
const createStyles = (tc) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, intro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  heading: { fontSize: 25, lineHeight: 32, fontFamily: fonts.display, color: tc(colors.text,'fg') },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, color: tc(colors.text,'fg'), marginTop: 24, marginBottom: 10 },
  person: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc(colors.border,'bg') },
  personMain: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: tc(colors.primarySoft,'bg') },
  initial: { fontSize: 17, color: tc(colors.primary,'fg') }, name: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: tc(colors.text,'fg') },
  caption: { fontSize: 12, lineHeight: 20, color: tc(colors.textMuted,'fg'), marginTop: 7 }, error: { color: tc(colors.danger,'fg'), fontSize: 13, lineHeight: 21 },
});

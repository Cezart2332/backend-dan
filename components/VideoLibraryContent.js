import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppHeader, AppScreen, PressableScale } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import VideoArtwork from './VideoArtwork';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function VideoLibraryContent({ navigation, title, description, lessons = [], sections = [], hasPaidSub = true, onPlay, sectionLabel = 'Videoclipurile tale', loading = false, error, onRetry, restricted = false }) {
  const { tc } = useTheme(), styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [searchFocused,setSearchFocused] = useState(false), [reduceMotion,setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if(active) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  const groups = useMemo(() => [
    ...(lessons.length ? [{ id: 'original', title: sectionLabel, videos: lessons }] : []),
    ...(hasPaidSub ? sections : []),
  ], [lessons,sections,hasPaidSub,sectionLabel]);
  const total = groups.reduce((count, group) => count + (group.videos || []).length, 0);
  const filtered = groups.map(group => ({ ...group, videos: (group.videos || []).filter(item => normalize(`${item.title} ${item.description || ''}`).includes(normalize(query))) })).filter(group => group.videos.length);
  const shown = filtered.reduce((count, group) => count + group.videos.length, 0);
  return <AppScreen contentStyle={styles.screen} overlay={<HeadphonesDisclaimer />}>
    <AppHeader title={title} onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')} />
    <View style={styles.hero}>
      <View style={styles.heroCopy}><Text style={styles.eyebrow}>Videoclipuri cu Dan</Text><Text style={styles.title}>Un moment{ '\n' }pentru tine.</Text></View>
      <VideoArtwork size={100} />
    </View>
    <Text style={styles.description}>{description || 'Alege un material și parcurge-l în ritmul tău. Poți viziona sau asculta doar sunetul.'}</Text>
    {total >= 6 ? <View style={[styles.search,searchFocused && styles.searchFocused]}><Feather name="search" size={19} color={tc(colors.textMuted,'fg')} /><TextInput style={styles.input} placeholder="Caută un videoclip" placeholderTextColor={tc(colors.textMuted,'fg')} value={query} onChangeText={setQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} accessibilityLabel="Caută un videoclip" returnKeyType="search" autoCorrect={false} />{query ? <PressableScale style={styles.clear} onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Șterge căutarea"><Feather name="x" size={18} color={tc(colors.primary,'fg')} /></PressableScale> : null}</View> : null}
    {loading ? <View style={styles.state}><ActivityIndicator color={tc(colors.primary,'fg')} /><Text style={styles.meta}>Se încarcă videoclipurile…</Text></View> : null}
    {error ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nu am putut încărca materialele.</Text><AppButton title="Reîncearcă" onPress={onRetry} /></View> : null}
    <View style={styles.collectionMeta}><Text style={styles.count} accessibilityLiveRegion="polite">{query ? `${shown} din ${total} materiale` : `${total} ${total === 1 ? 'material' : 'materiale'}`}</Text><View style={styles.modeHint}><Feather name="headphones" size={14} color={tc(colors.textMuted,'fg')} /><Text style={styles.meta}>Video sau doar sunet</Text></View></View>
    {filtered.map(group => <View key={group.id} style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">{group.title}</Text>
      {group.description ? <Text style={styles.groupDescription}>{group.description}</Text> : null}
      <View style={styles.cards}>{group.videos.map((item,index) => <PressableScale key={item.id} style={styles.card} scaleTo={reduceMotion ? 1 : 0.99} onPress={() => onPlay(item, group.id === 'original' ? null : group)} accessibilityRole="button" accessibilityLabel={`${item.kind === 'category' ? 'Deschide secțiunea' : 'Deschide videoclipul'}: ${item.title}`}>
        <View style={styles.thumbnail}><VideoArtwork size={86} icon={item.kind === 'category' ? 'folder' : 'play'} /><Text style={styles.number}>{String(index + 1).padStart(2,'0')}</Text></View>
        <View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.kind === 'category' ? 'Vezi materialele' : item.description || 'Cu Dan · Videoclip'}</Text></View>
        <Feather name="chevron-right" size={18} color={tc(colors.primary,'fg')} />
      </PressableScale>)}</View>
    </View>)}
    {!shown && !loading && !error && !restricted ? <View style={styles.empty}><Feather name={query ? 'search' : 'film'} size={25} color={tc(colors.accent,'fg')} /><Text style={styles.emptyTitle}>{query ? 'Niciun videoclip găsit.' : 'Materialele vor apărea aici.'}</Text><Text style={styles.description}>{query ? 'Încearcă alt cuvânt sau șterge căutarea.' : 'Revino când sunt disponibile materiale noi.'}</Text></View> : null}
    {restricted || (!hasPaidSub && sections.length) ? <View style={styles.extra}><Feather name="lock" size={21} color={tc(colors.accent,'fg')} /><Text style={styles.cardTitle}>{restricted ? 'Videoclipuri disponibile cu abonament' : 'Mai multe videoclipuri cu abonament'}</Text><AppButton title="Vezi abonamente" onPress={() => navigation.navigate('Subscriptions')} variant="ghost" /></View> : null}
  </AppScreen>;
}
const createStyles = tc => StyleSheet.create({
  screen: { width:'100%',maxWidth:680,alignSelf:'center',paddingBottom:36 },
  hero: { flexDirection:'row',alignItems:'center',gap:16,paddingTop:12,paddingBottom:10 },
  heroCopy: { flex:1,minWidth:0 },eyebrow:{fontSize:12,lineHeight:19,color:tc(colors.textMuted,'fg'),marginBottom:9},
  title:{fontFamily:fonts.display,fontSize:31,lineHeight:37,color:tc(colors.text,'fg')},
  description:{fontSize:14,lineHeight:23,color:tc(colors.textMuted,'fg'),marginBottom:22},
  search:{flexDirection:'row',alignItems:'center',gap:12,minHeight:54,borderRadius:16,backgroundColor:tc(colors.surfaceStrong,'bg'),paddingLeft:17,paddingRight:5,marginBottom:22,borderWidth:1,borderColor:'transparent'},searchFocused:{borderColor:tc(colors.primary,'fg')},
  input:{...Platform.select({web:{outlineStyle:'none'},default:{}}),flex:1,minWidth:0,paddingVertical:16,fontSize:14,color:tc(colors.text,'fg')},clear:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  collectionMeta:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginBottom:24},
  count:{fontSize:12,lineHeight:19,color:tc(colors.primary,'fg'),fontWeight:'600'},modeHint:{flexDirection:'row',alignItems:'center',gap:6},meta:{fontSize:11,lineHeight:18,color:tc(colors.textMuted,'fg')},
  group:{marginBottom:28},section:{fontFamily:fonts.display,fontSize:23,lineHeight:30,color:tc(colors.text,'fg'),marginBottom:15},groupDescription:{fontSize:13,lineHeight:21,color:tc(colors.textMuted,'fg'),marginBottom:16},
  cards:{gap:12},card:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderRadius:20,backgroundColor:tc(colors.surfaceStrong,'bg')},
  thumbnail:{width:86,height:84,borderRadius:13,backgroundColor:tc(colors.primarySoft,'bg'),justifyContent:'center',alignItems:'center',overflow:'hidden'},
  number:{position:'absolute',left:8,top:5,fontSize:10,lineHeight:16,color:tc(colors.textMuted,'fg'),fontVariant:['tabular-nums']},
  copy:{flex:1,minWidth:0},cardTitle:{fontSize:15,lineHeight:22,fontWeight:'600',color:tc(colors.text,'fg')},cardMeta:{fontSize:11,lineHeight:18,color:tc(colors.textMuted,'fg'),marginTop:6},
  state:{flexDirection:'row',gap:12,paddingVertical:20},empty:{gap:14,paddingVertical:30,alignItems:'flex-start'},emptyTitle:{fontFamily:fonts.display,fontSize:23,lineHeight:30,color:tc(colors.text,'fg')},
  extra:{padding:20,gap:14,borderRadius:20,backgroundColor:tc(colors.primarySoft,'bg')},
});

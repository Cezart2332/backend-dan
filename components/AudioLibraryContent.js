import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppHeader, AppScreen, PressableScale } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import Illustration from './Illustration';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

export default function AudioLibraryContent({ navigation, lessons, cmsSubsections, hasPaidSub }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const play = (item, artist = 'Dan fost anxios · Înțelege anxietatea') => navigation.navigate('AudioAnxietateVideo',{ title: item.title, videoFile: item.videoFile || `${item.storage_key}.mp4`, nowPlayingArtist: artist });
  const lesson = (item,index,artist) => <PressableScale key={item.id} style={styles.lesson} onPress={() => play(item,artist)} accessibilityRole="button" accessibilityLabel={`Deschide lecția: ${item.title}`}>
    <Text style={styles.number}>{String(index + 1).padStart(2,'0')}</Text><View style={styles.copy}><Text style={styles.lessonTitle}>{item.title}</Text><Text style={styles.meta}>Video · Poți asculta și doar sunetul</Text></View><View style={styles.play}><Feather name="play" size={17} color={tc(colors.primary,'fg')} /></View>
  </PressableScale>;
  return <AppScreen>
    <AppHeader title="Înțelege anxietatea" subtitle="Videoclipurile și explicațiile lui Dan." onBack={() => navigation.goBack()} />
    <View style={styles.hero}><View style={styles.copy}><Text style={styles.title}>Înțelege,{ '\n' }în ritmul tău.</Text><Text style={styles.body}>Alege un videoclip. Îl poți viziona sau asculta în ritmul tău.</Text></View><Illustration size={112} /></View>
    {lessons.length ? <AppButton title="Deschide Intro" icon="play" onPress={() => play(lessons[0])} /> : null}
    <Text style={styles.section} accessibilityRole="header">Lecțiile tale <Text style={styles.count}>· {lessons.length}</Text></Text>
    {lessons.map((item,index) => lesson(item,index))}
    {hasPaidSub ? cmsSubsections.map((sub) => <View key={sub.id}><Text style={styles.section} accessibilityRole="header">{sub.title}</Text>{(sub.videos || []).map((item,index) => lesson(item,index,`Dan fost anxios · ${sub.title}`))}</View>) : cmsSubsections.length ? <View style={styles.extra}><Text style={styles.lessonTitle}>Mai multe lecții cu abonament</Text><Text style={styles.body}>Descoperă conținutul suplimentar din bibliotecă.</Text><AppButton title="Vezi abonamente" onPress={() => navigation.navigate('Subscriptions')} variant="ghost" /></View> : null}
    <HeadphonesDisclaimer />
  </AppScreen>;
}
const createStyles = (tc) => StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 26 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 27, lineHeight: 33, fontFamily: fonts.display, color: tc(colors.text,'fg') },
  body: { fontSize: 13, lineHeight: 21, color: tc(colors.textMuted,'fg'), marginVertical: 12 },
  section: { fontSize: 22, lineHeight: 29, fontFamily: fonts.display, color: tc(colors.text,'fg'), marginTop: 30, marginBottom: 12 },
  count: { color: tc(colors.textMuted,'fg'), fontSize: 16 },
  lesson: { flexDirection: 'row', gap: 15, alignItems: 'center', paddingVertical: 19, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc(colors.border,'bg') },
  number: { fontSize: 13, color: tc(colors.textMuted,'fg'), fontVariant: ['tabular-nums'], minWidth: 22 },
  lessonTitle: { fontSize: 15, lineHeight: 23, fontWeight: '600', color: tc(colors.text,'fg') },
  meta: { fontSize: 11, lineHeight: 17, color: tc(colors.textMuted,'fg'), marginTop: 4 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tc(colors.primarySoft,'bg') },
  extra: { marginTop: 25 },
});

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, Easing, Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from './ui';
import { colors, fonts, gradients } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { hapticImpact } from '../utils/haptics';
import Illustration from './Illustration';

const TABS = [
  { key: 'home', label: 'Acasă', icon: 'home' },
  { key: 'practice', label: 'Exerciții', icon: 'wind' },
  { key: 'progress', label: 'Progres', icon: 'bar-chart-2' },
  { key: 'dan', label: 'Cu Dan', icon: 'message-circle' },
];

const PRACTICE = [
  { id: 6, title: 'Tehnica HAI', subtitle: 'Descoperă metoda, pas cu pas', icon: 'feather' },
  { id: 7, title: 'Conținut de ajutor', subtitle: 'Sprijin pentru momentele dificile', icon: 'heart' },
  { id: 10, title: 'Ascultă lecțiile lui Dan', subtitle: 'Videoclipuri despre anxietate, cu opțiunea Doar sunet', icon: 'headphones' },
];
const WITH_DAN = [
  { id: 8, title: 'Despre Dan', subtitle: 'Intro, cine sunt eu și din experiența mea', icon: 'user' },
  { id: 4, title: 'Intră în direct cu Dan', subtitle: 'Întâlniri și jurnalul tău', icon: 'video' },
  { id: 5, title: 'Trimite-mi o întrebare', subtitle: 'Primești un răspuns personal', icon: 'help-circle' },
  { id: 11, title: 'Webinarii', subtitle: 'Întâlniri live și înregistrări', icon: 'cast' },
  { id: 12, title: 'Comunitate chat', subtitle: 'Vorbește cu oameni care te înțeleg', icon: 'message-square' },
];

function greetingForNow() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bună dimineața' : hour < 18 ? 'Bună ziua' : 'Bună seara';
}

function useQuietMotion() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const focused = useIsFocused();
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduceMotion(value)).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appState = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { mounted = false; preference.remove(); appState.remove(); };
  }, []);
  return { reduceMotion, animate: !reduceMotion && foreground && focused };
}

function BreathingMark({ animate }) {
  const styles = useThemedStyles(createStyles);
  const { tc } = useTheme();
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { breath.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); breath.stopAnimation(); };
  }, [animate, breath]);
  return <View accessible={false} pointerEvents="none" style={styles.breathMark}>
    <Animated.View style={[styles.breathOuter, { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.9] }), transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] }]} />
    <Animated.View style={[styles.breathInner, { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.08] }) }] }]}>
      <Feather name="wind" size={30} color={tc(colors.white, 'fg')} />
    </Animated.View>
  </View>;
}

export default function DashboardContent({ navigation, profileName, profileAvatarUrl, subType, unreadNotifications, unreadChat, unreadSocial = 0, cmsSections, hasPaidSub, lockStateFor, handleMenuPress, showLockedPrompt, handleLogout }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState('home');
  const scroll = useRef(null);
  const tabProgress = useRef(new Animated.Value(1)).current;
  const tabOffset = useRef(new Animated.Value(0)).current;
  const previousTab = useRef('home');
  const { reduceMotion, animate } = useQuietMotion();
  const focused = useIsFocused();
  const pressScale = reduceMotion ? 1 : 0.98;
  useEffect(() => {
    tabProgress.stopAnimation();
    tabOffset.stopAnimation();
    if (previousTab.current === tab || !animate) {
      previousTab.current = tab; tabProgress.setValue(1); tabOffset.setValue(0); return;
    }
    const direction = TABS.findIndex(item => item.key === tab) > TABS.findIndex(item => item.key === previousTab.current) ? 1 : -1;
    previousTab.current = tab;
    tabProgress.setValue(0);
    tabOffset.setValue(direction * 14);
    const timing = { duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true };
    const transition = Animated.parallel([
      Animated.timing(tabProgress, { ...timing, toValue: 1 }),
      Animated.timing(tabOffset, { ...timing, toValue: 0 }),
    ]);
    transition.start();
    return () => transition.stop();
  }, [tab, animate, tabProgress, tabOffset]);
  useEffect(() => {
    if (!focused || tab === 'home' || Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setTab('home'); scroll.current?.scrollTo({ y: 0, animated: false }); return true; });
    return () => listener.remove();
  }, [tab, focused]);

  const selectTab = (key) => {
    if (key === tab) return;
    setTab(key);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const openSOS = () => { hapticImpact('medium'); navigation.navigate('Panic'); };
  const row = ({ title, subtitle, icon, onPress, locked = false, badge = 0 }) => <PressableScale
    key={title} onPress={onPress} scaleTo={pressScale} accessibilityRole="button"
    accessibilityLabel={`${title}${locked ? ', acces cu abonament' : ''}${badge > 0 ? `, ${badge} mesaje necitite` : ''}`}
    style={styles.row}
  >
    <View style={styles.rowIcon}><Feather name={icon} size={20} color={tc(colors.primary, 'fg')} /></View>
    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}</View>
    {badge > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    <Feather name={locked ? 'lock' : 'chevron-right'} size={17} color={tc(colors.textMuted, 'fg')} />
  </PressableScale>;
  const menuRow = (item) => {
    const { locked, lockLabel } = lockStateFor(item.id);
    return row({ ...item, locked, subtitle: locked ? lockLabel : item.subtitle, badge: item.id === 12 ? unreadChat : 0, onPress: () => handleMenuPress(item) });
  };
  const heading = (title, subtitle) => <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>;

  return <SafeAreaView style={styles.safeArea}>
    <LinearGradient colors={tc(gradients.screen, 'bg')} style={styles.fill}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>{greetingForNow()}</Text>
          <Text style={styles.name} numberOfLines={2}>{profileName || 'În spațiul tău sigur'}</Text>
        </View>
        <PressableScale scaleTo={pressScale} style={styles.headerButton} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel={unreadNotifications > 0 ? `Notificări, ${unreadNotifications} necitite` : 'Notificări'}>
          <Feather name="bell" size={21} color={tc(colors.primary, 'fg')} />
          {unreadNotifications > 0 ? <View style={styles.notificationDot} /> : null}
        </PressableScale>
        <PressableScale scaleTo={pressScale} style={styles.avatar} onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Profil">
          {profileAvatarUrl ? <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImage} /> : <Feather name="user" size={22} color={tc(colors.primary, 'fg')} />}
        </PressableScale>
      </View>

      <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: tabProgress.interpolate({ inputRange: [0,1], outputRange: [0.65,1] }), transform: [{ translateX: tabOffset }] }}>
        {tab === 'home' ? <>
          <PressableScale onPress={openSOS} scaleTo={pressScale} accessibilityRole="button" accessibilityLabel="Am nevoie de ajutor acum" accessibilityHint="Pornește imediat exercițiul SOS" style={styles.heroPress}>
            <LinearGradient colors={tc(gradients.primary, 'bg')} style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>SOS · Respirație ghidată</Text>
                <Text style={styles.heroTitle}>Respirăm{ '\n' }împreună.</Text>
                <Text style={styles.heroDescription}>Ia-ți un moment. Sunt aici cu tine.</Text>
              </View>
              <BreathingMark animate={animate} />
              <View style={styles.heroAction}><Text style={styles.heroActionText}>Am nevoie de ajutor acum</Text><Feather name="arrow-right" size={19} color={tc(colors.white, 'fg')} /></View>
            </LinearGradient>
          </PressableScale>

          <PressableScale onPress={() => handleMenuPress({ id: 10 })} scaleTo={pressScale} style={styles.explore} accessibilityRole="button" accessibilityLabel="Ascultă lecțiile lui Dan">
            <View style={styles.illustratedCopy}><Text style={styles.audioCtaTitle}>Ascultă lecțiile lui Dan</Text><Text style={styles.rowSubtitle}>Înțelege ce simți.{ '\n' }O lecție, în ritmul tău.</Text><View style={styles.audioCtaAction}><Text style={styles.exploreText}>Vezi videoclipurile</Text><Feather name="arrow-right" size={18} color={tc(colors.primary,'fg')} /></View></View><Illustration size={96} />
          </PressableScale>

          <PressableScale onPress={() => navigation.navigate('CheckIn')} scaleTo={pressScale} accessibilityRole="button" accessibilityLabel="Check-in rapid" style={styles.checkin}>
            <View style={styles.checkinIcon}><Feather name="plus" size={22} color={tc(colors.primary, 'fg')} /></View>
            <View style={styles.rowCopy}><Text style={styles.checkinTitle}>Cum te simți acum?</Text><Text style={styles.rowSubtitle}>Un check-in scurt, în ritmul tău.</Text></View>
            <Feather name="arrow-right" size={20} color={tc(colors.primary, 'fg')} />
          </PressableScale>

          {heading('Un pas pentru azi')}
          <PressableScale onPress={() => handleMenuPress({ id: 3 })} scaleTo={pressScale} accessibilityRole="button" accessibilityLabel="Provocări" style={styles.challenge}>
            <View style={styles.challengeTop}><Text style={styles.challengeLabel}>Provocările tale</Text><Feather name={lockStateFor(3).locked ? 'lock' : 'arrow-up-right'} size={21} color={tc(colors.primary, 'fg')} /></View>
            <View style={styles.illustratedRow}><Text style={[styles.challengeTitle, styles.illustratedCopy]}>Pas cu pas,{ '\n' }mai multă încredere.</Text><Illustration kind="journey" size={90} /></View>
            <Text style={styles.rowSubtitle}>Alege o provocare potrivită pentru tine.</Text>
          </PressableScale>
          {menuRow({ id: 2, title: 'Gândul zilei', subtitle: 'O perspectivă pe care o iei cu tine', icon: 'message-circle' })}

        </> : null}

        {tab === 'practice' ? <>
          {heading('În ritmul tău', 'Tehnici și resurse la care poți reveni oricând.')}
          <View style={styles.rows}>{PRACTICE.map(menuRow)}</View>
          {heading('La îndemână')}
          {row({ title: 'Kitul meu offline', subtitle: 'Exerciții, notițe și contacte salvate', icon: 'bookmark', onPress: () => navigation.navigate('OfflineKit') })}
          {cmsSections.length > 0 ? <>
            {heading('Conținut nou')}
            <View style={styles.rows}>{cmsSections.map((section) => row({ title: section.title, subtitle: hasPaidSub ? section.description || 'Conținut video' : 'Disponibil cu abonament', icon: 'layers', locked: !hasPaidSub, onPress: () => hasPaidSub ? navigation.navigate('CmsSection', { slug: section.slug, title: section.title }) : showLockedPrompt('Acest conținut este disponibil doar cu abonament activ.') }))}</View>
          </> : null}
        </> : null}

        {tab === 'progress' ? <>
          {heading('Drumul tău', 'Un loc pentru ce simți și pentru pașii pe care îi faci.')}
          <View style={styles.rows}>
            {row({ title: 'Check-in rapid', subtitle: 'Înregistrează cum te simți acum', icon: 'plus', onPress: () => navigation.navigate('CheckIn') })}
            {row({ title: 'Starea mea în timp', subtitle: 'Check-in-uri, evoluție și observații', icon: 'activity', onPress: () => navigation.navigate('MoodTimeline') })}
            {menuRow({ id: 1, title: 'Jurnalul meu', subtitle: 'Scrie ce simți și revino la însemnări', icon: 'book-open' })}
            {menuRow({ id: 3, title: 'Provocări', subtitle: 'Pașii tăi către mai multă încredere', icon: 'flag' })}
          </View>
        </> : null}

        {tab === 'dan' ? <>
          {heading('Împreună cu Dan', 'Întrebări, întâlniri și o comunitate aproape de tine.')}
          {row({ title: 'Prieteni și mesaje', subtitle: 'Cererile tale și conversații private', icon: 'users', badge: unreadSocial, onPress: () => navigation.navigate('Friends') })}
          <View style={styles.rows}>{WITH_DAN.map(menuRow)}</View>
          {heading('Mai aproape')}
          {row({ title: 'Grup Facebook', icon: 'users', onPress: () => Linking.openURL('https://www.facebook.com/groups/820094195023604/') })}
          {row({ title: 'Testimoniale', icon: 'heart', onPress: () => Linking.openURL('https://danfostanxios.ro/testimoniale-2/') })}
        </> : null}

        <View style={styles.account}>
          <PressableScale onPress={() => handleMenuPress({ id: 9 })} scaleTo={pressScale} accessibilityRole="button" accessibilityLabel="Abonamente și acces" style={styles.plan}>
            <Feather name="star" size={16} color={tc(colors.accent, 'fg')} /><Text style={styles.planLabel}>Abonamente și acces</Text>{subType ? <Text style={styles.planMeta}>{subType.toUpperCase()}</Text> : null}<Feather name="chevron-right" size={16} color={tc(colors.textMuted, 'fg')} />
          </PressableScale>
          <View style={styles.footerActions}>
            {[['Setări', () => navigation.navigate('Settings')], ['Termeni', () => navigation.navigate('Terms')], ['Ieșire', handleLogout]].map(([label, onPress]) => <PressableScale key={label} scaleTo={1} onPress={onPress} style={styles.footerButton} accessibilityRole="button" accessibilityLabel={label}><Text style={styles.footerText}>{label}</Text></PressableScale>)}
          </View>
          {tab === 'home' ? <Text style={styles.medicalNote}>Aplicația oferă conținut informativ și sprijin pentru stare de bine; nu înlocuiește un consult medical.</Text> : null}
          {tab === 'home' ? <PressableScale onPress={() => navigation.navigate('MedicalInfo')} scaleTo={1} style={styles.medicalLink} accessibilityRole="button" accessibilityLabel="Detalii și surse"><Text style={styles.footerText}>Detalii și surse</Text></PressableScale> : null}
        </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.dock}>
        {tab !== 'home' ? <PressableScale onPress={openSOS} scaleTo={pressScale} accessibilityRole="button" accessibilityLabel="Am nevoie de ajutor acum" style={styles.sosShortcut}><Feather name="wind" size={18} color={tc(colors.white, 'fg')} /><Text style={styles.sosShortcutText}>SOS · Am nevoie de ajutor acum</Text><Feather name="arrow-right" size={17} color={tc(colors.white, 'fg')} /></PressableScale> : null}
        <View style={styles.tabs} accessibilityRole={Platform.OS === 'web' ? 'tablist' : undefined}>
          {TABS.map((item) => <PressableScale key={item.key} onPress={() => selectTab(item.key)} scaleTo={pressScale} containerStyle={styles.tabContainer} style={[styles.tab, tab === item.key && styles.tabSelected]} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} {...(Platform.OS === 'web' ? { 'aria-selected': tab === item.key } : {})}>
            <View><Feather name={item.icon} size={21} color={tc(tab === item.key ? colors.primary : colors.textMuted, 'fg')} />{item.key === 'dan' && unreadChat + unreadSocial > 0 ? <View style={styles.tabDot} /> : null}</View>
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelSelected]}>{item.label}</Text>
          </PressableScale>)}
        </View>
      </View>
    </LinearGradient>
  </SafeAreaView>;
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc(colors.backgroundTop, 'bg'), ...(Platform.OS === 'web' ? StyleSheet.absoluteFillObject : {}) },
  fill: { flex: 1 },
  header: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 20 },
  headerCopy: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 13, color: tc(colors.textMuted, 'fg'), marginBottom: 3 },
  name: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, color: tc(colors.text, 'fg'), fontWeight: '600' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: tc(colors.primarySoft, 'bg'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: tc(colors.accent, 'bg') },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 24 },
  heroPress: { borderRadius: 26, overflow: 'hidden' },
  hero: { padding: 22, minHeight: 206, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  heroCopy: { flex: 1, minWidth: 120, zIndex: 1 },
  heroEyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '500', color: tc(colors.white, 'fg'), opacity: 0.8, marginBottom: 10 },
  heroTitle: { fontFamily: fonts.display, fontSize: 29, lineHeight: 34, fontWeight: '500', color: tc(colors.white, 'fg') },
  heroDescription: { fontSize: 12, lineHeight: 18, color: tc(colors.white, 'fg'), opacity: 0.8, marginTop: 9, maxWidth: 200 },
  breathMark: { width: 100, height: 100, flexShrink: 0, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  breathOuter: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: tc(colors.white, 'fg') },
  breathInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: tc(colors.white, 'fg'), alignItems: 'center', justifyContent: 'center' },
  heroAction: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc('rgba(246,247,248,0.35)', 'bg'), paddingTop: 15, marginTop: 20 },
  heroActionText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', color: tc(colors.white, 'fg') },
  checkin: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 22, marginBottom: 2 },
  checkinIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: tc(colors.primarySoft, 'bg'), alignItems: 'center', justifyContent: 'center' },
  checkinTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: tc(colors.text, 'fg') },
  sectionHeading: { marginTop: 20, marginBottom: 16 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, fontWeight: '500', color: tc(colors.text, 'fg') },
  sectionSubtitle: { fontSize: 14, lineHeight: 21, color: tc(colors.textMuted, 'fg'), marginTop: 8 },
  challenge: { backgroundColor: tc(colors.primarySoft, 'bg'), borderRadius: 22, padding: 20, marginBottom: 10 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  challengeLabel: { flex: 1, fontSize: 12, lineHeight: 18, color: tc(colors.textMuted, 'fg') },
  challengeTitle: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: tc(colors.text, 'fg'), marginBottom: 10 },
  rows: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc(colors.border, 'bg') },
  rowIcon: { width: 32, alignItems: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: tc(colors.text, 'fg') },
  rowSubtitle: { fontSize: 13, lineHeight: 20, color: tc(colors.textMuted, 'fg'), marginTop: 3 },
  badge: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: tc(colors.primary, 'bg') },
  badgeText: { fontSize: 11, color: tc(colors.white, 'fg'), fontWeight: '600' },
  explore: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 20, marginTop: 18, backgroundColor: tc(colors.surfaceStrong,'bg'), borderRadius: 22 },
  exploreText: { fontSize: 12, lineHeight: 20, fontWeight: '600', color: tc(colors.primary, 'fg') },
  illustratedRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  illustratedCopy: { flex: 1, minWidth: 0 },
  audioCtaTitle: { fontSize: 22, lineHeight: 27, fontFamily: fonts.display, color: tc(colors.text,'fg'), marginBottom: 6 },
  audioCtaAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  account: { marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc(colors.border, 'bg'), paddingTop: 16 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, flexWrap: 'wrap' },
  planLabel: { flex: 1, fontSize: 13, lineHeight: 20, color: tc(colors.text, 'fg') },
  planMeta: { fontSize: 10, lineHeight: 16, color: tc(colors.textMuted, 'fg') },
  footerActions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 4 },
  footerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 5 },
  footerText: { fontSize: 12, lineHeight: 19, color: tc(colors.textMuted, 'fg') },
  medicalNote: { fontSize: 11, lineHeight: 17, color: tc(colors.textMuted, 'fg'), marginTop: 12 },
  medicalLink: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  dock: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 8, backgroundColor: tc(colors.backgroundTop, 'bg'), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc(colors.border, 'bg') },
  sosShortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, marginBottom: 8, borderRadius: 16, backgroundColor: tc(colors.primary, 'bg') },
  sosShortcutText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: tc(colors.white, 'fg') },
  tabs: { flexDirection: 'row', gap: 4, paddingBottom: 4 },
  tabContainer: { flex: 1, minWidth: 0 },
  tab: { alignItems: 'center', justifyContent: 'center', minHeight: 62, gap: 5, paddingVertical: 9, paddingHorizontal: 2, borderRadius: 16 },
  tabSelected: { backgroundColor: tc(colors.primarySoft, 'bg') },
  tabLabel: { fontSize: 11, lineHeight: 16, color: tc(colors.textMuted, 'fg') },
  tabLabelSelected: { color: tc(colors.primary, 'fg'), fontWeight: '600' },
  tabDot: { position: 'absolute', top: -2, right: -5, width: 6, height: 6, borderRadius: 3, backgroundColor: tc(colors.accent, 'bg') },
});

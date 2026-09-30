import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import * as Crypto from 'expo-crypto';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppHeader, AppScreen, PressableScale } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import Illustration from './Illustration';
import AudioAccessGate from './AudioAccessGate';
import { API_BASE_URL } from '../utils/api';
import { getUser } from '../utils/userStorage';
import { createAudioTracker } from '../utils/audioTracker.mjs';
import { saveAudioSnapshot, syncAudioActivity } from '../utils/audioActivity';

const time = (value) => `${Math.floor(Math.max(0,value) / 60)}:${String(Math.floor(Math.max(0,value) % 60)).padStart(2,'0')}`;
export default function AudioPlayerScreen(props) {
  return <AudioAccessGate navigation={props.navigation}><AudioPlayerContent {...props} /></AudioAccessGate>;
}
function AudioPlayerContent({ route, navigation }) {
  const { title = 'Audio despre anxietate', videoFile = 'intelege_anxietatea_ganduri_si_emotii.mp4', nowPlayingArtist = 'Dan fost anxios' } = route.params || {};
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const focused = useIsFocused();
  const owner = useRef(null);
  const durationRef = useRef(0);
  const mounted = useRef(true);
  const tracker = useRef(createAudioTracker());
  const record = useRef({ clientId: Crypto.randomUUID(), occurredAt: new Date().toISOString(), mediaKey: videoFile });
  const [finished, setFinished] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const completionScale = useRef(new Animated.Value(1)).current;
  const source = useMemo(() => ({ uri: `${API_BASE_URL}/api/media/${encodeURIComponent(videoFile)}`, metadata: { title, artist: nowPlayingArtist } }), [videoFile,title,nowPlayingArtist]);
  const player = useVideoPlayer(source, (p) => { p.loop = false; p.timeUpdateEventInterval = 0.5; p.staysActiveInBackground = true; p.showNowPlayingNotification = true; p.audioMixingMode = 'doNotMix'; p.keepScreenOnWhilePlaying = false; });
  const { isPlaying } = useEvent(player,'playingChange',{ isPlaying: player.playing });
  const { status } = useEvent(player,'statusChange',{ status: player.status });
  const { currentTime } = useEvent(player,'timeUpdate',{ currentTime: 0 });
  const { duration: loadedDuration } = useEvent(player,'sourceLoad',{ duration: 0 });
  const duration = loadedDuration || player.duration || 0;
  durationRef.current = duration;
  const failed = status === 'error', loading = status === 'loading' || status === 'idle';
  const disabled = failed || loading || !duration;
  const flush = useRef(async () => {});
  flush.current = async () => {
    const snapshot = tracker.current.snapshot(durationRef.current);
    if (!owner.current || snapshot.durationMs <= 0 || snapshot.listenedMs <= 0) return;
    try { await saveAudioSnapshot(owner.current,{ ...record.current,...snapshot }); if (mounted.current) setSaveError(false); syncAudioActivity().catch(() => {}); }
    catch { if (mounted.current) setSaveError(true); }
  };
  useEffect(() => {
    mounted.current = true;
    getUser().then((user) => { if (mounted.current) owner.current = user?.id; });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted.current && setReduceMotion(value)).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return () => { mounted.current = false; motion.remove(); };
  }, []);
  useEffect(() => {
    const sample = () => tracker.current.sample(player.currentTime,Date.now(),player.playing,player.playbackRate || 1);
    const positionListener = player.addListener('timeUpdate',sample);
    const playingListener = player.addListener('playingChange',({ isPlaying: playing }) => { sample(); tracker.current.discontinuity(player.currentTime,Date.now(),playing); if (!playing) flush.current(); });
    const endListener = player.addListener('playToEnd',() => { sample(); tracker.current.end(); setCompleted(tracker.current.snapshot(player.duration).completed); setFinished(true); flush.current(); });
    const timer = setInterval(() => { if (player.playing) flush.current(); },15000);
    return () => { positionListener.remove(); playingListener.remove(); endListener.remove(); clearInterval(timer); flush.current(); };
  }, [player]);
  useEffect(() => {
    if (!focused) { player.pause(); player.showNowPlayingNotification = false; }
    else player.showNowPlayingNotification = true;
  }, [focused,player]);
  useEffect(() => {
    if (!finished || reduceMotion) { completionScale.setValue(1); return; }
    completionScale.setValue(0.9);
    const animation = Animated.spring(completionScale,{ toValue: 1, useNativeDriver: true, bounciness: 3, speed: 10 });
    animation.start(); return () => animation.stop();
  }, [finished,reduceMotion,completionScale]);
  const seek = (next) => {
    const value = Math.max(0,Math.min(duration,next));
    tracker.current.discontinuity(value,Date.now(),player.playing); player.currentTime = value; setPosition(value);
  };
  const replay = () => {
    tracker.current = createAudioTracker(); record.current = { clientId: Crypto.randomUUID(), occurredAt: new Date().toISOString(), mediaKey: videoFile };
    setFinished(false); setCompleted(false); player.currentTime = 0; setPosition(0); player.play();
  };
  return <AppScreen>
    <AppHeader title="Un moment de ascultare" onBack={() => navigation.goBack()} />
    <VideoView player={player} nativeControls={false} style={styles.media} accessible={false} pointerEvents="none" />
    {finished ? <View style={styles.completion}>
      <Animated.View style={{ alignSelf: 'center', marginBottom: 18, transform: [{ scale: completionScale }] }}><Illustration kind="complete" size={170} /></Animated.View>
      <Text style={styles.title} accessibilityLiveRegion="polite">{completed ? 'Ai ascultat până la capăt.' : 'Audio încheiat.'}</Text>
      <Text style={styles.subtitle}>{completed ? 'Un moment pe care l-ai oferit ție. Ascultarea se adaugă în profil după sincronizare.' : 'Poți reveni asupra lecției. O ascultare completă presupune parcurgerea a cel puțin 90% din audio.'}</Text>
      {saveError ? <><Text style={styles.error} accessibilityRole="alert">Nu am putut salva progresul pe telefon.</Text><AppButton title="Reîncearcă salvarea" onPress={() => flush.current()} /></> : null}
      <AppButton title="Vezi progresul din profil" icon="bar-chart-2" onPress={() => navigation.navigate('Profile')} />
      <AppButton title="Alege alt audio" variant="ghost" style={styles.nextAction} onPress={() => navigation.goBack()} />
      <AppButton title="Ascultă din nou" variant="ghost" style={styles.nextAction} onPress={replay} />
    </View> : <>
      <View style={styles.cover}><Illustration size={210} /><Text style={styles.coverCaption}>Ascultă. Înțelege. Revino când ai nevoie.</Text></View>
      <Text style={styles.title}>{title}</Text><Text style={styles.artist}>{nowPlayingArtist}</Text>
      {loading ? <View style={styles.state}><ActivityIndicator color={tc(colors.primary,'fg')} /><Text style={styles.subtitle}>Se încarcă audio-ul…</Text></View> : null}
      {failed ? <View style={styles.state}><Text style={styles.error} accessibilityRole="alert">Audio-ul nu s-a putut încărca.</Text><AppButton title="Reîncearcă" onPress={() => player.replace(source)} /></View> : null}
      <View style={styles.progress}>
        <Slider accessibilityLabel="Poziție în audio" disabled={disabled} minimumValue={0} maximumValue={duration || 1} value={seeking ? position : currentTime || 0} minimumTrackTintColor={tc(colors.primary,'fg')} maximumTrackTintColor={tc(colors.primarySoft,'bg')} thumbTintColor={tc(colors.accent,'fg')} onSlidingStart={() => { tracker.current.discontinuity(player.currentTime,Date.now(),false); setSeeking(true); }} onValueChange={setPosition} onSlidingComplete={(value) => { seek(value); setSeeking(false); }} />
        <View style={styles.timeRow}><Text style={styles.time}>{time(seeking ? position : currentTime || 0)}</Text><Text style={styles.time}>{time(duration)}</Text></View>
      </View>
      <View style={styles.controls}>
        <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)-15)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Înapoi 15 secunde"><Feather name="rotate-ccw" size={25} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>15 sec</Text></PressableScale>
        <PressableScale disabled={disabled} onPress={() => isPlaying ? player.pause() : player.play()} style={[styles.play,disabled && styles.disabled]} scaleTo={reduceMotion ? 1 : 0.96} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pauză audio' : 'Redă audio'}><Feather name={isPlaying ? 'pause' : 'play'} size={31} color={tc(colors.white,'fg')} /></PressableScale>
        <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)+30)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Înainte 30 secunde"><Feather name="rotate-cw" size={25} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>30 sec</Text></PressableScale>
      </View>
      <View style={styles.speeds}>{[0.75,1,1.25,1.5].map((speed) => <PressableScale key={speed} onPress={() => { tracker.current.discontinuity(player.currentTime,Date.now(),player.playing); player.playbackRate = speed; setRate(speed); }} scaleTo={1} style={[styles.speed,rate === speed && styles.activeSpeed]} accessibilityRole="button" accessibilityState={{ selected: speed === rate }} accessibilityLabel={`Viteza ${speed} ori`}><Text style={styles.speedText}>{speed}×</Text></PressableScale>)}</View>
      <Text style={styles.subtitle}>Poți asculta și cu ecranul blocat. Revino la ideile care îți sunt utile.</Text>
      {saveError ? <Text style={styles.error}>Progresul nu s-a putut salva. Reîncearcă din ecranul de final.</Text> : null}
    </>}
  </AppScreen>;
}
const createStyles = (tc) => StyleSheet.create({
  media: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  cover: { alignItems: 'center', backgroundColor: tc(colors.primarySoft,'bg'), borderRadius: 28, paddingVertical: 20, marginVertical: 18 },
  coverCaption: { color: tc(colors.textMuted,'fg'), fontSize: 11, lineHeight: 18, paddingHorizontal: 15 },
  title: { fontFamily: fonts.display, fontSize: 27, lineHeight: 34, color: tc(colors.text,'fg'), marginBottom: 8 },
  artist: { color: tc(colors.textMuted,'fg'), fontSize: 13, lineHeight: 20 },
  subtitle: { color: tc(colors.textMuted,'fg'), fontSize: 13, lineHeight: 21, marginVertical: 12 },
  progress: { marginTop: 30 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  time: { color: tc(colors.textMuted,'fg'), fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginVertical: 24 },
  play: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: tc(colors.primary,'bg') },
  skip: { minWidth: 48, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 6 },
  skipLabel: { fontSize: 11, color: tc(colors.textMuted,'fg') },
  speeds: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  speed: { minWidth: 48, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeSpeed: { backgroundColor: tc(colors.primarySoft,'bg') },
  speedText: { fontSize: 12, color: tc(colors.primary,'fg') },
  disabled: { opacity: 0.4 },
  state: { paddingVertical: 16 },
  error: { color: tc(colors.danger,'fg'), fontSize: 13, lineHeight: 21 },
  completion: { paddingVertical: 28, alignItems: 'stretch' },
  nextAction: { marginTop: 12 },
});

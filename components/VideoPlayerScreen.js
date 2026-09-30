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
import HeadphonesDisclaimer from './HeadphonesDisclaimer';
import { resolveLessonSource } from '../utils/lessonSource.mjs';
import { API_BASE_URL } from '../utils/api';
import { getUser } from '../utils/userStorage';
import { createAudioTracker } from '../utils/audioTracker.mjs';
import { saveAudioSnapshot, syncAudioActivity } from '../utils/audioActivity';

const time = (value) => `${Math.floor(Math.max(0,value) / 60)}:${String(Math.floor(Math.max(0,value) % 60)).padStart(2,'0')}`;
export default function VideoPlayerScreen(props) {
  return <LessonPlayerContent key={props.videoFile} {...props} />;
}
function LessonPlayerContent({ navigation, title = 'Lecție cu Dan', subtitle = '', videoFile, nowPlayingTitle, nowPlayingArtist = 'Dan fost anxios', nowPlayingArtwork, nowPlayingAccent }) {
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
  const [audioOnly, setAudioOnly] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [resolving, setResolving] = useState(true);
  const videoView = useRef(null);
  const loadedSource = useRef(null);
  const completionScale = useRef(new Animated.Value(1)).current;
  const source = useMemo(() => {
    const id = videoFile.replace(/\.[^.]+$/, '');
    const artworkParams = new URLSearchParams({ title: nowPlayingTitle || title, artist: nowPlayingArtist });
    if (nowPlayingAccent) artworkParams.set('accent', nowPlayingAccent);
    const artwork = nowPlayingArtwork ? new URL(nowPlayingArtwork.startsWith('/') || /^https?:/.test(nowPlayingArtwork) ? nowPlayingArtwork : `/api/media/${nowPlayingArtwork}`, `${API_BASE_URL}/`).href : `${API_BASE_URL}/api/videos/${encodeURIComponent(id)}/artwork?${artworkParams}`;
    return { metadata: { title: nowPlayingTitle || title, artist: nowPlayingArtist, artwork } };
  }, [videoFile,title,nowPlayingTitle,nowPlayingArtist,nowPlayingArtwork,nowPlayingAccent]);
  // One player and one published source; changing presentation never reloads it.
  const player = useVideoPlayer(null, (p) => { p.loop = false; p.timeUpdateEventInterval = 0.5; p.staysActiveInBackground = true; p.showNowPlayingNotification = true; p.audioMixingMode = 'doNotMix'; p.keepScreenOnWhilePlaying = true; });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResolving(true); setSourceError(false);
    (async () => {
      const uri = await resolveLessonSource(videoFile, API_BASE_URL, fetch, controller.signal);
      if (!active) return;
      loadedSource.current = { ...source, uri, contentType: 'hls' };
      await player.replaceAsync(loadedSource.current);
    })().catch(() => { if (active) setSourceError(true); }).finally(() => { if (active) setResolving(false); });
    return () => { active = false; controller.abort(); };
  }, [videoFile,source,player]);
  useEffect(() => { player.keepScreenOnWhilePlaying = !audioOnly; }, [audioOnly,player]);
  const { isPlaying } = useEvent(player,'playingChange',{ isPlaying: player.playing });
  const { status } = useEvent(player,'statusChange',{ status: player.status });
  const { currentTime } = useEvent(player,'timeUpdate',{ currentTime: 0 });
  const { duration: loadedDuration } = useEvent(player,'sourceLoad',{ duration: 0 });
  const duration = loadedDuration || player.duration || 0;
  durationRef.current = duration;
  const failed = sourceError || status === 'error', loading = !failed && (resolving || status === 'loading' || status === 'idle');
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
  const retry = async () => {
    setSourceError(false); setResolving(true);
    try {
      const uri = await resolveLessonSource(videoFile,API_BASE_URL,fetch);
      if (!mounted.current) return;
      loadedSource.current = { ...source, uri, contentType: 'hls' };
      await player.replaceAsync(loadedSource.current);
    }
    catch { if (mounted.current) setSourceError(true); }
    finally { if (mounted.current) setResolving(false); }
  };
  const pauseAndSave = () => {
    tracker.current.sample(player.currentTime,Date.now(),player.playing,player.playbackRate || 1);
    player.pause(); flush.current();
  };
  return <AppScreen>
    <AppHeader title={subtitle || 'Lecția ta cu Dan'} onBack={() => { pauseAndSave(); navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'); }} />
    <View style={[styles.videoStage,audioOnly && styles.hiddenStage]}>
      <VideoView ref={videoView} player={player} nativeControls={false} fullscreenOptions={{ enable: true }} allowsPictureInPicture contentFit="contain" style={styles.video} accessible={!audioOnly} pointerEvents={audioOnly ? 'none' : 'auto'} />
      {!audioOnly && !finished ? <PressableScale style={styles.fullscreen} onPress={() => videoView.current?.enterFullscreen()} accessibilityRole="button" accessibilityLabel="Ecran complet"><Feather name="maximize" size={19} color={colors.white} /></PressableScale> : null}
    </View>
    {finished ? <View style={styles.completion}>
      <Animated.View style={{ alignSelf: 'center', marginBottom: 18, transform: [{ scale: completionScale }] }}><Illustration kind="complete" size={170} /></Animated.View>
      <Text style={styles.title} accessibilityLiveRegion="polite">{completed ? 'Ai parcurs materialul.' : 'Redare încheiată.'}</Text>
      <Text style={styles.subtitle}>{completed ? 'Un moment pe care l-ai oferit ție. Lecția se adaugă în profil după sincronizare.' : 'Poți reveni asupra lecției. Finalizarea presupune parcurgerea a cel puțin 90% din material.'}</Text>
      {saveError ? <><Text style={styles.error} accessibilityRole="alert">Nu am putut salva progresul pe telefon.</Text><AppButton title="Reîncearcă salvarea" onPress={() => flush.current()} /></> : null}
      <AppButton title="Vezi progresul din profil" icon="bar-chart-2" onPress={() => { pauseAndSave(); navigation.navigate('Profile'); }} />
      <AppButton title="Alege altă lecție" variant="ghost" style={styles.nextAction} onPress={() => navigation.goBack()} />
      <AppButton title="Redă din nou" variant="ghost" style={styles.nextAction} onPress={replay} />
    </View> : <>
      {audioOnly ? <View style={styles.cover}><Illustration size={170} /><Text style={styles.coverCaption}>Aceeași lecție, doar sunetul. Poți bloca ecranul.</Text></View> : null}
      <Text style={styles.title}>{title}</Text><Text style={styles.artist}>{nowPlayingArtist}</Text>
      {loading ? <View style={styles.state}><ActivityIndicator color={tc(colors.primary,'fg')} /><Text style={styles.subtitle}>Se încarcă videoclipul…</Text></View> : null}
      {failed ? <View style={styles.state}><Text style={styles.error} accessibilityRole="alert">Materialul nu s-a putut încărca.</Text><AppButton title="Reîncearcă" onPress={retry} /></View> : null}
      <View style={styles.progress}>
        <Slider accessibilityLabel="Poziție în lecție" disabled={disabled} minimumValue={0} maximumValue={duration || 1} value={seeking ? position : currentTime || 0} minimumTrackTintColor={tc(colors.primary,'fg')} maximumTrackTintColor={tc(colors.primarySoft,'bg')} thumbTintColor={tc(colors.accent,'fg')} onSlidingStart={() => { tracker.current.discontinuity(player.currentTime,Date.now(),false); setSeeking(true); }} onValueChange={setPosition} onSlidingComplete={(value) => { seek(value); setSeeking(false); }} />
        <View style={styles.timeRow}><Text style={styles.time}>{time(seeking ? position : currentTime || 0)}</Text><Text style={styles.time}>{time(duration)}</Text></View>
      </View>
      <View style={styles.controls}>
        <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)-15)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Înapoi 15 secunde"><Feather name="rotate-ccw" size={25} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>15 sec</Text></PressableScale>
        <PressableScale disabled={disabled} onPress={() => isPlaying ? player.pause() : player.play()} style={[styles.play,disabled && styles.disabled]} scaleTo={reduceMotion ? 1 : 0.96} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pauză' : 'Redă lecția'}><Feather name={isPlaying ? 'pause' : 'play'} size={31} color={tc(colors.white,'fg')} /></PressableScale>
        <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)+30)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Înainte 30 secunde"><Feather name="rotate-cw" size={25} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>30 sec</Text></PressableScale>
      </View>
      <View style={styles.speeds}>{[0.5,0.75,1,1.25,1.5,2].map((speed) => <PressableScale key={speed} onPress={() => { tracker.current.discontinuity(player.currentTime,Date.now(),player.playing); player.playbackRate = speed; setRate(speed); }} scaleTo={1} style={[styles.speed,rate === speed && styles.activeSpeed]} accessibilityRole="button" accessibilityState={{ selected: speed === rate }} accessibilityLabel={`Viteza ${speed} ori`}><Text style={styles.speedText}>{speed}×</Text></PressableScale>)}</View>
      <PressableScale onPress={() => setAudioOnly(value => !value)} style={styles.modeToggle} scaleTo={reduceMotion ? 1 : 0.98} accessibilityRole="button" accessibilityLabel={audioOnly ? 'Revino la video' : 'Ascultă doar sunetul'} accessibilityState={{ selected: audioOnly }}><Feather name={audioOnly ? 'film' : 'headphones'} size={18} color={tc(colors.primary,'fg')} /><Text style={styles.modeText}>{audioOnly ? 'Revino la video' : 'Ascultă doar sunetul'}</Text></PressableScale>
      <Text style={styles.subtitle}>Poți viziona lecția sau asculta același videoclip cu ecranul blocat.</Text>
      {saveError ? <Text style={styles.error}>Progresul nu s-a putut salva. Reîncearcă din ecranul de final.</Text> : null}
    </>}
    <HeadphonesDisclaimer />
  </AppScreen>;
}
const createStyles = (tc) => StyleSheet.create({
  videoStage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.primaryDark, marginVertical: 20 },
  video: { width: '100%', height: '100%' },
  hiddenStage: { position: 'absolute', width: 1, height: 1, opacity: 0, marginVertical: 0 },
  fullscreen: { position: 'absolute', right: 12, bottom: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(16,25,35,0.65)' },
  modeToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 18, backgroundColor: tc(colors.primarySoft,'bg') },
  modeText: { color: tc(colors.primary,'fg'), fontSize: 13, fontWeight: '600' },
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
  speeds: { flexDirection: 'row', justifyContent: 'center', gap: 2, flexWrap: 'wrap', marginBottom: 20 },
  speed: { minWidth: 48, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeSpeed: { backgroundColor: tc(colors.primarySoft,'bg') },
  speedText: { fontSize: 12, color: tc(colors.primary,'fg') },
  disabled: { opacity: 0.4 },
  state: { paddingVertical: 16 },
  error: { color: tc(colors.danger,'fg'), fontSize: 13, lineHeight: 21 },
  completion: { paddingVertical: 28, alignItems: 'stretch' },
  nextAction: { marginTop: 12 },
});

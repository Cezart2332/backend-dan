import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { isPictureInPictureSupported, useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import * as Crypto from 'expo-crypto';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppHeader, AppScreen, PressableScale } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import Illustration from './Illustration';
import VideoArtwork from './VideoArtwork';
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
  const pictureInPictureSupported = useMemo(() => {
    try { return isPictureInPictureSupported(); } catch { return false; }
  }, []);
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
  const [speedOpen, setSpeedOpen] = useState(false);
  const [viewError, setViewError] = useState(null);
  const openView = async (method) => {
    setViewError(null);
    try { await videoView.current?.[method](); }
    catch { setViewError('Modul de afișare nu este disponibil momentan.'); }
  };
  const displayedPosition = seeking ? position : currentTime || 0;
  return <AppScreen contentStyle={styles.screen} overlay={<HeadphonesDisclaimer />}>
    <AppHeader title={subtitle || 'Videoclip cu Dan'} onBack={() => { pauseAndSave(); navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'); }} />
    {!finished ? <View style={styles.heading}><Text style={styles.title}>{title}</Text><Text style={styles.artist}>{nowPlayingArtist}</Text></View> : null}
    <View style={[styles.videoStage,(audioOnly || finished) && styles.hiddenStage]}>
      <VideoView ref={videoView} player={player} nativeControls={false} fullscreenOptions={{ enable: true }} allowsPictureInPicture contentFit="contain" style={styles.video} accessible={!audioOnly && !finished} pointerEvents={audioOnly || finished ? 'none' : 'auto'} />
      {!audioOnly && !finished && !failed && !loading ? <PressableScale disabled={disabled} style={styles.fullscreen} onPress={() => openView('enterFullscreen')} accessibilityRole="button" accessibilityLabel="Ecran complet"><Feather name="maximize" size={20} color={colors.white} /></PressableScale> : null}
      {!audioOnly && !finished && (failed || loading) ? <View style={styles.videoOverlay}><VideoArtwork size={100} />{loading ? <ActivityIndicator color={tc(colors.primary,'fg')} /> : <Feather name="alert-circle" size={21} color={tc(colors.textMuted,'fg')} />}</View> : null}
    </View>
    {finished ? <View style={styles.completion}>
      <Animated.View style={{ alignSelf: 'center', marginBottom: 22, transform: [{ scale: completionScale }] }}><Illustration kind="complete" size={150} /></Animated.View>
      <Text style={styles.eyebrow}>Un moment oferit ție</Text>
      <Text style={styles.title} accessibilityLiveRegion="polite">{completed ? 'Ai parcurs materialul.' : 'Redare încheiată.'}</Text>
      <Text style={styles.subtitle}>{completed ? 'Progresul tău se adaugă în profil după sincronizare. Continuă în ritmul tău.' : 'Poți reveni asupra videoclipului. Se adaugă la materialele finalizate după parcurgerea a cel puțin 90%.'}</Text>
      {saveError ? <><Text style={styles.error} accessibilityRole="alert">Nu am putut salva progresul pe telefon.</Text><AppButton title="Reîncearcă salvarea" onPress={() => flush.current()} /></> : null}
      <View style={styles.finishActions}><AppButton title="Alege alt videoclip" icon="film" onPress={() => navigation.goBack()} /><AppButton title="Vezi progresul din profil" icon="bar-chart-2" variant="ghost" onPress={() => { pauseAndSave(); navigation.navigate('Profile'); }} /><AppButton title="Redă din nou" variant="ghost" onPress={replay} /></View>
    </View> : <>
      {audioOnly ? <View style={styles.audioStage}><View style={styles.audioMark}><Feather name="headphones" size={33} color={tc(colors.primary,'fg')} /></View><Text style={styles.audioTitle}>Doar sunetul</Text><Text style={styles.audioCaption}>Același videoclip. Poți bloca ecranul.</Text></View> : null}
      <View style={styles.modeSwitch}>
        {[false,true].map(onlySound => <PressableScale key={String(onlySound)} onPress={() => setAudioOnly(onlySound)} scaleTo={1} containerStyle={styles.modeCell} style={[styles.modeOption,audioOnly === onlySound && styles.activeMode]} accessibilityRole="button" accessibilityLabel={onlySound ? 'Ascultă doar sunetul' : 'Vizionare video'} accessibilityState={{selected:audioOnly === onlySound}}><Feather name={onlySound ? 'headphones' : 'film'} size={17} color={tc(colors.primary,'fg')} /><Text style={[styles.modeText,audioOnly === onlySound && styles.activeModeText]}>{onlySound ? 'Doar sunet' : 'Video'}</Text></PressableScale>)}
      </View>
      {loading ? <Text style={styles.statusText} accessibilityLiveRegion="polite">Se încarcă videoclipul…</Text> : null}
      {failed ? <View style={styles.failure}><Text style={styles.error} accessibilityRole="alert">Videoclipul nu s-a putut încărca.</Text><PressableScale style={styles.retry} onPress={retry} accessibilityRole="button" accessibilityLabel="Reîncearcă încărcarea"><Feather name="refresh-cw" size={17} color={tc(colors.primary,'fg')} /><Text style={styles.modeText}>Reîncearcă</Text></PressableScale></View> : null}
      <View style={styles.console}>
        <View style={styles.timeRow}><Text style={styles.time}>{time(displayedPosition)}</Text><Text style={styles.time}>{time(duration)}</Text></View>
        <Slider style={styles.slider} accessibilityLabel="Poziție în videoclip" accessibilityValue={{text:`${time(displayedPosition)} din ${time(duration)}`}} disabled={disabled} minimumValue={0} maximumValue={duration || 1} value={displayedPosition} minimumTrackTintColor={tc(colors.primary,'fg')} maximumTrackTintColor={tc(colors.primarySoft,'bg')} thumbTintColor={tc(colors.accent,'fg')} onSlidingStart={() => { tracker.current.discontinuity(player.currentTime,Date.now(),false); setSeeking(true); }} onValueChange={setPosition} onSlidingComplete={(value) => { seek(value); setSeeking(false); }} />
        <View style={styles.controls}>
          <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)-15)} style={[styles.skip,disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel="Înapoi 15 secunde"><Feather name="rotate-ccw" size={24} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>15 sec</Text></PressableScale>
          <PressableScale disabled={disabled} onPress={() => isPlaying ? player.pause() : player.play()} style={[styles.play,disabled && styles.disabled]} scaleTo={reduceMotion ? 1 : 0.96} accessibilityRole="button" accessibilityLabel={isPlaying && !disabled ? 'Pauză' : 'Redă videoclipul'}><Feather name={isPlaying && !disabled ? 'pause' : 'play'} size={32} color={tc(colors.white,'fg')} style={!isPlaying ? {marginLeft:3} : null} /></PressableScale>
          <PressableScale disabled={disabled} onPress={() => seek((player.currentTime || 0)+30)} style={[styles.skip,disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel="Înainte 30 secunde"><Feather name="rotate-cw" size={24} color={tc(colors.primary,'fg')} /><Text style={styles.skipLabel}>30 sec</Text></PressableScale>
        </View>
        <View style={styles.consoleFooter}><PressableScale style={styles.speedToggle} onPress={() => setSpeedOpen(value => !value)} accessibilityRole="button" accessibilityLabel={`Viteză de redare: ${rate} ori`} accessibilityState={{expanded:speedOpen}}><Feather name="sliders" size={16} color={tc(colors.primary,'fg')} /><Text style={styles.modeText}>Viteză · {rate}×</Text><Feather name={speedOpen ? 'chevron-up' : 'chevron-down'} size={15} color={tc(colors.textMuted,'fg')} /></PressableScale>{!audioOnly && pictureInPictureSupported ? <PressableScale disabled={disabled} style={styles.pip} onPress={() => openView('startPictureInPicture')} accessibilityRole="button" accessibilityLabel="Redă în fereastră mică"><Feather name="minimize-2" size={18} color={tc(colors.primary,'fg')} /></PressableScale> : null}</View>
        {speedOpen ? <View style={styles.speeds}>{[0.5,0.75,1,1.25,1.5,2].map(speed => <PressableScale key={speed} onPress={() => { tracker.current.discontinuity(player.currentTime,Date.now(),player.playing); player.playbackRate = speed; setRate(speed); setSpeedOpen(false); }} scaleTo={1} containerStyle={styles.speedCell} style={[styles.speed,rate === speed && styles.activeSpeed]} accessibilityRole="button" accessibilityState={{selected:speed === rate}} accessibilityLabel={`Viteza ${speed} ori`}><Text style={[styles.speedText,rate === speed && styles.activeSpeedText]}>{speed}×</Text></PressableScale>)}</View> : null}
      </View>
      <View style={styles.tip}><Feather name="headphones" size={17} color={tc(colors.accent,'fg')} /><Text style={styles.tipText}>Cu căști, îți poți oferi un moment fără distrageri.</Text></View>
      {viewError ? <Text style={styles.error} accessibilityRole="alert">{viewError}</Text> : null}
      {saveError ? <Text style={styles.error}>Progresul nu s-a putut salva. Reîncearcă din ecranul de final.</Text> : null}
    </>}
  </AppScreen>;
}
const createStyles = tc => StyleSheet.create({
  screen:{width:'100%',maxWidth:680,alignSelf:'center',paddingBottom:30},
  heading:{paddingTop:10,paddingBottom:22},eyebrow:{fontSize:12,lineHeight:19,color:tc(colors.textMuted,'fg'),marginBottom:10},
  title:{fontFamily:fonts.display,fontSize:29,lineHeight:37,color:tc(colors.text,'fg'),marginBottom:10},artist:{fontSize:12,lineHeight:20,color:tc(colors.textMuted,'fg')},
  videoStage:{width:'100%',aspectRatio:16/9,borderRadius:22,overflow:'hidden',backgroundColor:colors.primaryDark,marginBottom:18},video:{width:'100%',height:'100%'},
  hiddenStage:{position:'absolute',width:1,height:1,opacity:0,marginBottom:0},fullscreen:{position:'absolute',right:10,bottom:10,width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:'rgba(16,25,35,0.65)'},
  videoOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:tc(colors.primarySoft,'bg'),alignItems:'center',justifyContent:'center',gap:12},
  audioStage:{paddingVertical:24,paddingHorizontal:20,borderRadius:22,backgroundColor:tc(colors.primarySoft,'bg'),alignItems:'center',marginBottom:18},audioMark:{width:70,height:70,borderRadius:24,backgroundColor:tc(colors.surfaceStrong,'bg'),alignItems:'center',justifyContent:'center',marginBottom:15},audioTitle:{fontFamily:fonts.display,fontSize:24,lineHeight:30,color:tc(colors.text,'fg')},audioCaption:{fontSize:12,lineHeight:20,color:tc(colors.textMuted,'fg'),textAlign:'center',marginTop:6},
  modeSwitch:{flexDirection:'row',backgroundColor:tc(colors.primarySoft,'bg'),padding:5,borderRadius:18,gap:6,marginBottom:18},modeCell:{flex:1,minWidth:0},modeOption:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,borderRadius:13},activeMode:{backgroundColor:tc(colors.surfaceStrong,'bg')},modeText:{fontSize:13,lineHeight:20,color:tc(colors.primary,'fg')},activeModeText:{fontWeight:'600'},
  statusText:{fontSize:13,lineHeight:21,color:tc(colors.textMuted,'fg'),marginBottom:16},failure:{gap:5,paddingBottom:16},retry:{flexDirection:'row',alignItems:'center',gap:9,alignSelf:'flex-start',minHeight:44,paddingHorizontal:10},error:{fontSize:13,lineHeight:21,color:tc(colors.danger,'fg')},
  console:{padding:18,borderRadius:24,backgroundColor:tc(colors.surfaceStrong,'bg')},timeRow:{flexDirection:'row',justifyContent:'space-between'},time:{fontSize:12,lineHeight:18,color:tc(colors.textMuted,'fg'),fontVariant:['tabular-nums']},slider:{height:40,marginHorizontal:-4},
  controls:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14,marginTop:10,marginBottom:22},play:{width:80,height:80,borderRadius:40,alignItems:'center',justifyContent:'center',backgroundColor:tc(colors.primary,'bg')},skip:{width:62,minHeight:66,borderRadius:18,backgroundColor:tc(colors.primarySoft,'bg'),alignItems:'center',justifyContent:'center',gap:7},skipLabel:{fontSize:11,lineHeight:17,color:tc(colors.primary,'fg')},disabled:{opacity:0.4},
  consoleFooter:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:tc(colors.border,'bg'),paddingTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},speedToggle:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},pip:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:tc(colors.primarySoft,'bg')},
  speeds:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},speedCell:{flexBasis:'30%',flexGrow:1,minWidth:58},speed:{minHeight:46,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:tc(colors.primarySoft,'bg')},activeSpeed:{backgroundColor:tc(colors.primary,'bg')},speedText:{fontSize:13,color:tc(colors.primary,'fg')},activeSpeedText:{color:tc(colors.white,'fg'),fontWeight:'600'},
  tip:{flexDirection:'row',gap:10,alignItems:'center',marginTop:22,paddingHorizontal:4},tipText:{flex:1,fontSize:12,lineHeight:20,color:tc(colors.textMuted,'fg')},subtitle:{fontSize:14,lineHeight:23,color:tc(colors.textMuted,'fg'),marginVertical:12},completion:{paddingTop:40},finishActions:{gap:12,marginTop:24},
});

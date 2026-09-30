import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Alert, ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { AppScreen } from './ui';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from './ui/theme';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { Choices, PrivacyNotice, WellbeingGate } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { breathingPhase, createSessionClock, CONTEXTS, GROUNDING, LABELS, recommendations } from '../utils/wellbeingCore.mjs';

const PHASE_LABELS = { inhale: 'Inspiră ușor', hold: 'Pauză scurtă', exhale: 'Expiră lent' };
export default function PanicScreen(props) {
  const { allowed, owner } = useWellbeing();
  const admitted = useRef(null);
  if (allowed && !admitted.current) admitted.current = owner;
  // Once admitted, allow this session to finish even if the subscription expires.
  if (owner && admitted.current === owner) return <PanicSession {...props} admittedOwner={owner} />;
  return <WellbeingGate {...props} title="SOS · un moment pentru tine"><View /></WellbeingGate>;
}
function PanicSession({ navigation, route, admittedOwner }) {
  const wellbeing = useWellbeing();
  const { preferences, metadata, save, data, updatePreferences, owner } = wellbeing;
  const local = useThemedStyles(createPanicStyles);
  const { tc } = useTheme();
  const [initial] = useState(() => ({ ...metadata(), duration: preferences.duration, pattern: preferences.pattern }));
  const [clock] = useState(() => createSessionClock(initial.duration * 1000));
  const techniques = useRef(new Set([route.params?.mode === 'grounding' ? 'grounding' : 'breathing']));
  const [mode, setMode] = useState(route.params?.mode === 'grounding' ? 'grounding' : 'breathing');
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState({ rating: null, level: null, context: null });
  const [saving, setSaving] = useState(false);
  const [persistError, setPersistError] = useState(null);
  const finishedRef = useRef(false);
  const savedPromise = useRef(null);
  const finalRecord = useRef(null);
  const latestSave = useRef(save); latestSave.current = save;
  const controls = useRef({ paused, mode, preferences }); controls.current = { paused, mode, preferences };
  const scale = useRef(new Animated.Value(0.8)).current;
  const delayedHaptic = useRef(null);
  const audioFade = useRef(null);
  const lastPhase = useRef(null);
  const ambient = useAudioPlayer(require('../assets/wellbeing/ambient.wav'));
  const inhale = useAudioPlayer(require('../assets/wellbeing/inhale.wav'));
  const hold = useAudioPlayer(require('../assets/wellbeing/hold.wav'));
  const exhale = useAudioPlayer(require('../assets/wellbeing/exhale.wav'));
  const players = useRef(null); players.current = { ambient, inhale, hold, exhale };
  const silence = useCallback((fade = false) => {
    if (audioFade.current) clearInterval(audioFade.current);
    audioFade.current = null;
    const volumes = Object.values(players.current).map((player) => { try { return [player, player.volume]; } catch { return [player, 0]; } });
    const stop = () => { for (const [player] of volumes) { try { player.pause(); player.volume = 0; } catch {} } };
    if (!fade) { stop(); return; }
    const start = performance.now();
    audioFade.current = setInterval(() => {
      const amount = Math.max(0, 1 - (performance.now() - start) / 200);
      for (const [player, volume] of volumes) { try { player.volume = volume * amount; } catch {} }
      if (amount === 0) { clearInterval(audioFade.current); audioFade.current = null; stop(); }
    }, 20);
  }, []);
  const keepAwake = useCallback(async () => {
    try {
      await activateKeepAwakeAsync('wellbeing-sos');
      if (!clock.running || finishedRef.current || AppState.currentState !== 'active') await deactivateKeepAwake('wellbeing-sos');
    } catch {}
  }, [clock]);
  const stopEffects = useCallback((fade = false) => {
    if (delayedHaptic.current) clearTimeout(delayedHaptic.current);
    delayedHaptic.current = null;
    lastPhase.current = null;
    silence(fade);
    deactivateKeepAwake('wellbeing-sos').catch(() => {});
  }, [silence]);
  async function persist(status = 'stopped') {
    if (!finalRecord.current) finalRecord.current = { ...initial, status, elapsedMs: Math.round(clock.elapsed()), techniques: [...techniques.current], feedback: null };
    if (!savedPromise.current) {
      savedPromise.current = latestSave.current('sessions', finalRecord.current, true, admittedOwner).catch((error) => { savedPromise.current = null; throw error; });
    }
    return savedPromise.current;
  }
  const finish = useRef(null);
  finish.current = (status) => {
    if (finishedRef.current) return;
    finishedRef.current = true; clock.pause(); stopEffects(true); setFinished(true);
    persist(status).catch((error) => setPersistError(error.message));
  };
  useEffect(() => {
    clock.resume();
    keepAwake();
    ambient.loop = true;
    for (const player of Object.values(players.current)) player.volume = 0;
    // Playback only: no microphone permission or background media service.
    setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, allowsRecording: false, interruptionMode: 'doNotMix' }).catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && !finishedRef.current) { clock.pause(); stopEffects(); setPaused(true); }
    });
    const blur = navigation.addListener('blur', () => { if (!finishedRef.current) { clock.pause(); stopEffects(); setPaused(true); } });
    return () => {
      clock.pause(); stopEffects(); motion.remove(); state.remove(); blur();
      if (!finishedRef.current && clock.elapsed() > 0) { finishedRef.current = true; persist('stopped').catch(() => {}); }
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (finishedRef.current || !clock.running) return;
      const ms = clock.elapsed(); setElapsed(ms);
      if (ms >= initial.duration * 1000) { finish.current('completed'); return; }
      const current = controls.current;
      if (current.paused || current.mode !== 'breathing') return;
      const phase = breathingPhase(ms, initial.pattern);
      const progress = phase.name === 'inhale' ? phase.progress : phase.name === 'hold' ? 1 : 1 - phase.progress;
      scale.setValue(0.8 + progress * 0.25);
      const audio = players.current;
      if (current.preferences.sound) {
        if (audioFade.current) { clearInterval(audioFade.current); audioFade.current = null; }
        const targetVolume = current.preferences.volume * Math.min(1, (initial.duration * 1000 - ms) / 500);
        try { audio.ambient.volume = Math.max(0, Math.min(targetVolume, audio.ambient.volume + 0.02)); if (!audio.ambient.playing) audio.ambient.play(); } catch {}
      }
      if (phase.key === lastPhase.current) return;
      lastPhase.current = phase.key;
      if (delayedHaptic.current) clearTimeout(delayedHaptic.current);
      if (current.preferences.haptics) {
        Haptics.impactAsync(phase.name === 'hold' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (phase.name === 'exhale') delayedHaptic.current = setTimeout(() => {
          if (clock.running && !finishedRef.current && controls.current.preferences.haptics && controls.current.mode === 'breathing') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }, 180);
      }
      if (current.preferences.sound) {
        const player = audio[phase.name];
        try { player.volume = current.preferences.volume; player.seekTo(0).then(() => {
          if (clock.running && !finishedRef.current && controls.current.preferences.sound && controls.current.mode === 'breathing' && lastPhase.current === phase.key) player.play();
        }).catch(() => {}); } catch {}
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (!preferences.sound || !preferences.haptics) {
    if (!preferences.sound) silence(true);
    if (!preferences.haptics && delayedHaptic.current) clearTimeout(delayedHaptic.current);
  } }, [preferences.sound, preferences.haptics]);
  const togglePause = () => {
    if (paused) { clock.resume(); keepAwake(); setPaused(false); }
    else { clock.pause(); stopEffects(); setPaused(true); }
  };
  const switchMode = (next) => {
    stopEffects(); techniques.current.add(next); setMode(next);
    if (!paused) keepAwake();
  };
  const changePreference = (key, value) => updatePreferences({ [key]: value }).catch((error) => Alert.alert('Setare nesalvată', error.message));
  const close = async (withFeedback) => {
    if (saving || owner !== admittedOwner) return;
    setSaving(true); setPersistError(null);
    try {
      await persist();
      if (withFeedback) await save('sessions', { ...finalRecord.current, feedback }, true, admittedOwner);
      navigation.goBack();
    } catch (error) { setPersistError(error.message); }
    finally { setSaving(false); }
  };
  const phase = breathingPhase(elapsed, initial.pattern);
  const helped = useMemo(() => recommendations(data?.sessions || [], data?.checkins || []), [data?.sessions, data?.checkins]);
  const remaining = Math.max(0, Math.ceil(initial.duration - elapsed / 1000));
  const openSettings = () => { clock.pause(); stopEffects(); setPaused(true); setSettingsOpen(true); };
  const pauseTitle = paused ? 'Continuă exercițiul' : 'Ia o pauză';
  return <AppScreen contentStyle={local.screen}>
    <View style={local.header}>
      <Pressable onPress={() => settingsOpen ? setSettingsOpen(false) : finished ? close(false) : finish.current('stopped')} style={local.iconButton} accessibilityRole="button" accessibilityLabel={settingsOpen ? 'Înapoi la exercițiu' : 'Încheie exercițiul'}><Feather name="chevron-left" size={24} color={tc(colors.primary,'fg')} /></Pressable>
      <Text style={local.headerLabel}>{settingsOpen ? 'Sunet și vibrații' : finished ? 'Un moment pentru tine' : 'SOS'}</Text>
      {!settingsOpen && !finished ? <Pressable onPress={openSettings} style={local.iconButton} accessibilityRole="button" accessibilityLabel="Setări de sunet și vibrații"><Feather name="sliders" size={21} color={tc(colors.primary,'fg')} /></Pressable> : <View style={local.iconButton} />}
    </View>
    {settingsOpen ? <View style={local.settings}>
      <Text style={local.title}>Așa cum îți este bine.</Text>
      <Text style={local.description}>Exercițiul este în pauză. Alege dacă vrei sunet sau vibrații.</Text>
      <View style={local.settingRow}><View style={local.settingCopy}><Text style={local.settingTitle}>Sunet liniștit</Text><Text style={local.settingHint}>Un fundal discret pentru respirație.</Text></View><Switch accessibilityLabel="Sunet liniștit" value={preferences.sound} onValueChange={value => changePreference('sound',value)} trackColor={{false:tc(colors.primarySoft,'bg'),true:tc(colors.primary,'bg')}} /></View>
      {preferences.sound ? <View style={local.volume}><Text style={local.settingTitle}>Volum · {Math.round(preferences.volume * 100)}%</Text><Slider accessibilityLabel="Volumul sunetului" minimumValue={0} maximumValue={1} step={0.05} value={preferences.volume} minimumTrackTintColor={tc(colors.accent,'fg')} thumbTintColor={tc(colors.primary,'fg')} onSlidingComplete={value => changePreference('volume',value)} /></View> : null}
      <View style={local.settingRow}><View style={local.settingCopy}><Text style={local.settingTitle}>Vibrații ușoare</Text><Text style={local.settingHint}>Te ajută să urmărești respirația fără să privești ecranul.</Text></View><Switch accessibilityLabel="Vibrații ușoare" value={preferences.haptics} onValueChange={value => changePreference('haptics',value)} trackColor={{false:tc(colors.primarySoft,'bg'),true:tc(colors.primary,'bg')}} /></View>
      <View style={local.actions}><SosButton title="Înapoi la exercițiu" icon="arrow-left" onPress={() => setSettingsOpen(false)} /><SosButton title="Durata și ritmul respirației" subtitle="Se aplică la următorul exercițiu." icon="clock" variant="outline" onPress={() => { setSettingsOpen(false); navigation.navigate('WellbeingSettings'); }} /></View>
    </View> : finished ? <View style={local.finish}>
      <View style={local.finishMark}><Feather name="check" size={34} color={tc(colors.primary,'fg')} /></View>
      <Text style={local.title}>Ai luat un moment pentru tine.</Text>
      <Text style={local.description}>Poți încheia aici. Dacă vrei, spune-ne cum a fost.</Text>
      {feedbackOpen ? <View style={local.feedback}>
        <Text style={local.settingTitle}>Exercițiul te-a ajutat?</Text>
        <View style={local.feedbackChoices}>{['helpful','neutral','unhelpful'].map(rating => <SosButton key={rating} title={LABELS[rating]} variant="outline" selected={feedback.rating === rating} onPress={() => setFeedback(old => ({...old,rating:old.rating === rating ? null : rating}))} />)}</View>
        <Text style={local.settingTitle}>Cât de intensă este anxietatea acum?</Text><Text style={local.settingHint}>1 = foarte puțin · 10 = foarte intens</Text>
        <View style={local.levels}>{[1,2,3,4,5,6,7,8,9,10].map(level => <Pressable key={level} style={[local.level,feedback.level === level && local.selectedLevel]} accessibilityRole="button" accessibilityLabel={`Anxietate ${level} din 10`} accessibilityState={{selected:feedback.level === level}} onPress={() => setFeedback(old => ({...old,level:old.level === level ? null : level}))}><Text style={[local.levelText,feedback.level === level && local.selectedLevelText]}>{level}</Text></Pressable>)}</View>
        <Choices label="Unde te aflai? (opțional)" values={CONTEXTS} value={feedback.context} onChange={context => setFeedback(old => ({...old,context}))} />
        <PrivacyNotice />
      </View> : null}
      {persistError ? <Text style={local.error} accessibilityRole="alert">{persistError} · Poți reîncerca.</Text> : null}
      <View style={local.actions}><SosButton title={feedbackOpen ? 'Salvează și încheie' : 'Încheie'} icon="check" loading={saving} onPress={() => close(feedbackOpen)} /><SosButton title={feedbackOpen ? 'Încheie fără evaluare' : 'Spune cum a fost (opțional)'} variant="outline" disabled={saving} onPress={() => feedbackOpen ? close(false) : setFeedbackOpen(true)} /></View>
    </View> : <>
      <View style={local.sessionMeta}><View style={local.timer}><Feather name="clock" size={14} color={tc(colors.textMuted,'fg')} /><Text style={local.timerText}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2,'0')} rămase{paused ? ' · Pauză' : ''}</Text></View></View>
      {mode === 'breathing' ? <View style={local.stage}>
        <Text style={local.title} accessibilityLiveRegion="polite">{paused ? 'Ia-ți timpul tău.' : PHASE_LABELS[phase.name]}</Text>
        <Text style={local.description}>{paused ? 'Continuă când te simți pregătit.' : 'Urmărește cercul. Respiră fără să forțezi.'}</Text>
        <View style={local.breathingMark}>
          <Animated.View accessible={false} pointerEvents="none" style={[local.breathCircle,{transform:[{scale:reduceMotion ? 1 : scale}]}]} />
          <View accessible={false} style={local.breathCount}><Text style={local.count}>{paused ? '–' : phase.remaining}</Text><Text style={local.countUnit}>{paused ? 'în pauză' : phase.remaining === 1 ? 'secundă' : 'secunde'}</Text></View>
        </View>
        <Text style={local.breathHint}>{paused ? 'Nu trebuie să te grăbești.' : phase.name === 'inhale' ? 'Lasă aerul să intre ușor.' : phase.name === 'hold' ? 'Dacă nu e confortabil, expiră ușor.' : 'Lasă aerul să iasă încet.'}</Text>
      </View> : <View style={local.sensesStage}>
        <Text style={local.stepLabel}>Pasul {step + 1} din 5</Text>
        <View style={local.steps} accessible={false}>{GROUNDING.map((_,index) => <View key={index} style={[local.stepDot,index <= step && local.activeStepDot]} />)}</View>
        <View style={local.senseMark}><Feather name={['eye','feather','headphones','wind','coffee'][step]} size={34} color={tc(colors.primary,'fg')} /></View>
        <Text style={local.title} accessibilityLiveRegion="polite">{GROUNDING[step][0]}</Text>
        <Text style={local.description}>{GROUNDING[step][1]}</Text>
        {step === 0 ? <Text style={local.settingHint}>Le poți numi în gând sau cu voce joasă.</Text> : null}
        <View style={local.actions}><SosButton title={paused ? 'Continuă exercițiul' : step === 4 ? 'Am terminat' : 'Următorul pas'} icon={paused ? 'play' : step === 4 ? 'check' : 'arrow-right'} onPress={() => paused ? togglePause() : step === 4 ? finish.current('completed') : setStep(step + 1)} />{step > 0 && !paused ? <SosButton title="Pasul anterior" variant="text" onPress={() => setStep(step - 1)} /> : null}</View>
      </View>}
      <View style={local.actions}>
        {mode === 'breathing' || !paused ? <SosButton title={pauseTitle} icon={paused ? 'play' : 'pause'} variant={mode === 'breathing' ? 'solid' : 'outline'} onPress={togglePause} /> : null}
        <SosButton title={mode === 'breathing' ? 'Observă ce te înconjoară' : 'Revino la respirație'} subtitle={mode === 'breathing' ? 'Privește, atinge și ascultă. Pas cu pas.' : 'Urmărește din nou cercul.'} icon={mode === 'breathing' ? 'eye' : 'wind'} variant="outline" onPress={() => switchMode(mode === 'breathing' ? 'grounding' : 'breathing')} />
        <SosButton title="Încheie exercițiul" variant="text" onPress={() => finish.current('stopped')} />
      </View>
      {helped.length > 0 ? <View style={local.previous}><Text style={local.settingTitle}>Ce te-a ajutat înainte</Text><View style={local.actions}>{helped.map(item => <SosButton key={item.technique} title={LABELS[item.technique]} variant="outline" onPress={() => switchMode(item.technique)} />)}</View></View> : null}
      <View style={local.help}><SosButton title="Mai multe exerciții de ajutor" icon="book-open" variant="text" onPress={() => { clock.pause(); stopEffects(); setPaused(true); navigation.navigate('Ajutor'); }} /></View>
    </>}
  </AppScreen>;
}
function SosButton({ title, subtitle, onPress, icon, variant = 'solid', disabled = false, loading = false, selected }) {
  const styles = useThemedStyles(createPanicStyles), {tc} = useTheme();
  const solid = variant === 'solid' || selected;
  const color = tc(solid ? colors.white : colors.primary,'fg');
  return <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} accessibilityState={{disabled:disabled || loading,busy:loading,selected}} style={({pressed}) => [styles.button,solid ? styles.solidButton : variant === 'text' ? styles.textButton : styles.outlineButton,(disabled || loading) && styles.disabled,pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={color} /> : <>{icon ? <Feather name={icon} size={20} color={color} /> : null}<View style={styles.buttonCopy}><Text style={[styles.buttonTitle,{color}]}>{title}</Text>{subtitle ? <Text style={styles.buttonSubtitle}>{subtitle}</Text> : null}</View>{subtitle ? <Feather name="chevron-right" size={18} color={color} /> : null}</>}
  </Pressable>;
}
const createPanicStyles = tc => StyleSheet.create({
  screen: { width:'100%',maxWidth:560,alignSelf:'center',paddingBottom:32 },
  header: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16 },
  headerLabel: { fontSize:16,fontWeight:'600',color:tc(colors.text,'fg'),flex:1,textAlign:'center',marginHorizontal:8 },
  iconButton: { width:48,height:48,alignItems:'center',justifyContent:'center',borderRadius:16 },
  sessionMeta: { alignItems:'center',marginBottom:20 },
  timer: { flexDirection:'row',alignItems:'center',gap:8,backgroundColor:tc(colors.primarySoft,'bg'),paddingHorizontal:14,paddingVertical:9,borderRadius:20 },
  timerText: { fontSize:12,fontVariant:['tabular-nums'],color:tc(colors.textMuted,'fg') },
  stage: { alignItems:'center',marginBottom:24 },
  title: { fontFamily:fonts.display,fontSize:30,lineHeight:38,color:tc(colors.text,'fg'),textAlign:'center',marginBottom:12 },
  description: { fontSize:15,lineHeight:24,color:tc(colors.textMuted,'fg'),textAlign:'center',marginBottom:20 },
  breathingMark: { width:'100%',maxWidth:232,aspectRatio:1,alignItems:'center',justifyContent:'center',marginVertical:10 },
  breathCircle: { ...StyleSheet.absoluteFillObject,borderRadius:120,backgroundColor:tc(colors.primarySoft,'bg'),borderWidth:1,borderColor:tc(colors.accent,'fg') },
  breathCount: { alignItems:'center',justifyContent:'center' },
  count: { fontFamily:fonts.display,fontSize:62,lineHeight:74,color:tc(colors.text,'fg'),fontVariant:['tabular-nums'] },
  countUnit: { fontSize:13,color:tc(colors.textMuted,'fg'),marginTop:2 },
  breathHint: { fontSize:14,lineHeight:22,color:tc(colors.textMuted,'fg'),textAlign:'center',marginTop:20 },
  actions: { gap:14 },
  button: { minHeight:58,paddingVertical:17,paddingHorizontal:18,borderRadius:18,flexDirection:'row',alignItems:'center',gap:12 },
  solidButton: { backgroundColor:tc(colors.primary,'bg') },
  outlineButton: { backgroundColor:tc(colors.surfaceStrong,'bg'),borderWidth:1,borderColor:tc(colors.border,'bg') },
  textButton: { backgroundColor:'transparent',justifyContent:'center' },
  buttonCopy: { flex:1,minWidth:0 },
  buttonTitle: { fontSize:15,lineHeight:22,fontWeight:'600' },
  buttonSubtitle: { fontSize:12,lineHeight:19,color:tc(colors.textMuted,'fg'),marginTop:5 },
  pressed: { opacity:0.8 },disabled:{opacity:0.45},
  sensesStage: { marginBottom:28 },
  stepLabel: { textAlign:'center',fontSize:13,color:tc(colors.textMuted,'fg'),marginBottom:12 },
  steps: { flexDirection:'row',justifyContent:'center',gap:8,marginBottom:24 },
  stepDot: { width:26,height:4,borderRadius:2,backgroundColor:tc(colors.primarySoft,'bg') },
  activeStepDot: { backgroundColor:tc(colors.accent,'fg') },
  senseMark: { width:82,height:82,borderRadius:26,backgroundColor:tc(colors.primarySoft,'bg'),alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:24 },
  settingRow: { flexDirection:'row',alignItems:'center',gap:20,paddingVertical:24,borderBottomWidth:1,borderBottomColor:tc(colors.border,'bg') },
  settingCopy: { flex:1 },
  settingTitle: { fontSize:16,lineHeight:24,fontWeight:'600',color:tc(colors.text,'fg'),marginBottom:6 },
  settingHint: { fontSize:13,lineHeight:21,color:tc(colors.textMuted,'fg'),textAlign:'center' },
  volume: { marginVertical:20 },
  settings: { paddingTop:20,gap:18 },
  finish: { paddingTop:16 },
  finishMark: { width:80,height:80,borderRadius:40,backgroundColor:tc(colors.primarySoft,'bg'),alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:24 },
  feedback: { marginTop:20,marginBottom:24 },
  feedbackChoices: { gap:12,marginTop:10,marginBottom:26 },
  levels: { flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:14,marginBottom:28 },
  level: { flexBasis:'17%',flexGrow:1,minWidth:44,minHeight:48,borderRadius:14,backgroundColor:tc(colors.surfaceStrong,'bg'),borderWidth:1,borderColor:tc(colors.border,'bg'),alignItems:'center',justifyContent:'center' },
  levelText: { fontSize:16,color:tc(colors.text,'fg') },
  selectedLevel: { backgroundColor:tc(colors.primary,'bg') },selectedLevelText:{color:tc(colors.white,'fg')},
  error: { color:tc(colors.danger,'fg'),fontSize:14,lineHeight:22,marginVertical:16 },
  previous: { borderTopWidth:1,borderTopColor:tc(colors.border,'bg'),paddingTop:24,marginTop:28 },
  help: { marginTop:18 },
});

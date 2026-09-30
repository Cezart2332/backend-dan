import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { AppButton, AppCard, AppHeader, AppScreen } from './ui';
import { useTheme } from './ui/themeContext';
import { Choices, PrivacyNotice, WellbeingGate, useWellbeingStyles } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { breathingPhase, createSessionClock, CONTEXTS, GROUNDING, LABELS, recommendations } from '../utils/wellbeingCore.mjs';

const PHASE_LABELS = { inhale: 'Inspiră ușor', hold: 'Ține, dacă este confortabil', exhale: 'Expiră lent' };
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
  const s = useWellbeingStyles();
  const { tc } = useTheme();
  const [initial] = useState(() => ({ ...metadata(), duration: preferences.duration, pattern: preferences.pattern }));
  const [clock] = useState(() => createSessionClock(initial.duration * 1000));
  const techniques = useRef(new Set([route.params?.mode === 'grounding' ? 'grounding' : 'breathing']));
  const [mode, setMode] = useState(route.params?.mode === 'grounding' ? 'grounding' : 'breathing');
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
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
  return <AppScreen><AppHeader title={finished ? 'Ai făcut un pas pentru tine' : 'Sunt aici cu tine'} subtitle="Respiră confortabil, fără să forțezi." onBack={() => finished ? close(false) : finish.current('stopped')} />
    {finished ? <AppCard><Text style={s.heading}>Cum a fost?</Text><Text style={s.body}>Feedback-ul este opțional.</Text>
      <Choices label="Exercițiul" values={['helpful', 'neutral', 'unhelpful']} value={feedback.rating} onChange={(rating) => setFeedback((old) => ({ ...old, rating }))} />
      <Choices label="Anxietate acum" values={[1,2,3,4,5,6,7,8,9,10]} value={feedback.level} onChange={(level) => setFeedback((old) => ({ ...old, level }))} />
      <Choices label="Context" values={CONTEXTS} value={feedback.context} onChange={(context) => setFeedback((old) => ({ ...old, context }))} /><PrivacyNotice />
      {persistError && <Text style={s.body} accessibilityRole="alert">{persistError} · Poți reîncerca.</Text>}
      <AppButton title="Salvează feedback" loading={saving} onPress={() => close(true)} /><AppButton title="Încheie fără feedback" variant="ghost" disabled={saving} onPress={() => close(false)} />
    </AppCard> : <>
      <AppCard><Text style={s.muted}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2,'0')} rămase {paused ? '· În pauză' : ''}</Text>
        {mode === 'breathing' ? <View style={local.center}><Animated.View accessible={false} style={[local.circle, { backgroundColor: tc('#e8ebef','bg'), borderColor: tc('#b3924f','fg'), transform: [{ scale: reduceMotion ? 1 : scale }] }]}><Text style={[s.heading, { textAlign: 'center' }]} accessibilityLiveRegion="polite">{paused ? 'Ia-ți timpul tău' : PHASE_LABELS[phase.name]}</Text><Text style={s.body}>{paused ? 'Reia când vrei' : `${phase.remaining} secunde`}</Text></Animated.View></View> : <View style={local.grounding}><Text style={s.heading} accessibilityLiveRegion="polite">{GROUNDING[step][0]}</Text><Text style={s.body}>{GROUNDING[step][1]}</Text><AppButton title={step === 4 ? 'Încheie grounding' : 'Următorul pas'} disabled={paused} onPress={() => step === 4 ? finish.current('completed') : setStep(step + 1)} /></View>}
        <AppButton title={paused ? 'Reia exercițiul' : 'Pauză'} onPress={togglePause} /><AppButton title={mode === 'breathing' ? 'Treci la grounding' : 'Revino la respirație'} variant="ghost" onPress={() => switchMode(mode === 'breathing' ? 'grounding' : 'breathing')} />
        <View style={s.row}><Text style={s.label}>Sunet discret</Text><Switch accessibilityLabel="Sunet discret" value={preferences.sound} onValueChange={(v) => changePreference('sound', v)} /></View>
        {preferences.sound && <><Text style={s.label}>Volum: {Math.round(preferences.volume * 100)}%</Text><Slider accessibilityLabel="Volumul exercițiului" minimumValue={0} maximumValue={1} step={0.05} value={preferences.volume} onSlidingComplete={(value) => changePreference('volume', value)} /></>}
        <View style={s.row}><Text style={s.label}>Vibrații</Text><Switch accessibilityLabel="Vibrații ghidate" value={preferences.haptics} onValueChange={(v) => changePreference('haptics', v)} /></View>
        <Text style={s.muted}>Inspir: un impuls · Ținut: un impuls distinct · Expir: două impulsuri. Unele setări ale telefonului pot opri vibrațiile.</Text>
        <AppButton title="Oprește exercițiul" variant="ghost" onPress={() => finish.current('stopped')} />
      </AppCard>
      {helped.length > 0 && <AppCard><Text style={s.heading}>Ce te-a ajutat înainte</Text>{helped.map((item) => <AppButton key={item.technique} title={`${LABELS[item.technique]} · ${item.count} evaluări pozitive`} variant="ghost" onPress={() => switchMode(item.technique)} />)}</AppCard>}
      <AppButton title="Ajutorul existent" variant="ghost" onPress={() => { clock.pause(); stopEffects(); setPaused(true); navigation.navigate('Ajutor'); }} /><PrivacyNotice />
    </>}
  </AppScreen>;
}
const local = StyleSheet.create({ center: { minHeight: 250, alignItems: 'center', justifyContent: 'center' }, circle: { width: 235, height: 235, borderRadius: 120, borderWidth: 2, padding: 20, alignItems: 'center', justifyContent: 'center' }, grounding: { minHeight: 220, justifyContent: 'center' } });

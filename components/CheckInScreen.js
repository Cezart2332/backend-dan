import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen, AppTextField } from './ui';
import { Choices, PrivacyNotice, WellbeingGate, useWellbeingStyles } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { CONTEXTS } from '../utils/wellbeingCore.mjs';
import { hapticNotify } from '../utils/haptics';

export default function CheckInScreen(props) { return <WellbeingGate {...props} title="Check-in rapid"><CheckInForm {...props} /></WellbeingGate>; }
function CheckInForm({ navigation }) {
  const { save, metadata } = useWellbeing();
  const s = useWellbeingStyles();
  const [form, setForm] = useState({ level: null, note: '', sleep: null, caffeine: null, activity: null, context: null });
  const [saving, setSaving] = useState(false);
  const change = (field) => (value) => setForm((old) => ({ ...old, [field]: value }));
  async function submit() {
    if (!form.level) return Alert.alert('Nivel lipsă', 'Selectează nivelul de anxietate.');
    if (saving) return;
    setSaving(true);
    try {
      await save('checkins', { ...metadata(), ...form });
      hapticNotify('success');
      navigation.replace('MoodTimeline');
    } catch (error) { Alert.alert('Nu am putut salva', error.message); }
    finally { setSaving(false); }
  }
  return <AppScreen keyboard><AppHeader title="Cum te simți acum?" subtitle="Un check-in de 20 de secunde" onBack={() => navigation.goBack()} /><AppCard>
    <Choices label="Nivel de anxietate (1–10)" values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} value={form.level} onChange={change('level')} optional={false} />
    <Text style={s.muted}>1 = foarte puțină anxietate · 10 = foarte intensă. Restul câmpurilor sunt opționale.</Text>
    <Choices label="Context" values={CONTEXTS} value={form.context} onChange={change('context')} />
    <Choices label="Cum ai dormit?" values={['poor', 'average', 'good']} value={form.sleep} onChange={change('sleep')} />
    <Choices label="Cafeină astăzi" values={['none', 'some', 'much']} value={form.caffeine} onChange={change('caffeine')} />
    <Choices label="Activitate" values={['rest', 'walk', 'exercise', 'work', 'social', 'other']} value={form.activity} onChange={change('activity')} />
    <AppTextField label="O notiță, dacă vrei" multiline maxLength={4000} value={form.note} onChangeText={change('note')} />
    <PrivacyNotice /><AppButton title="Salvează check-in" loading={saving} onPress={submit} />
  </AppCard><AppButton title="Jurnalul meu" variant="ghost" onPress={() => navigation.navigate('Progress')} /></AppScreen>;
}

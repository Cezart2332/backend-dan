import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen } from './ui';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { useWellbeing } from '../contexts/WellbeingContext';
import { LABELS } from '../utils/wellbeingCore.mjs';

export function useWellbeingStyles() { return useThemedStyles(styles); }
export function Choices({ label, values, value, onChange, optional = true }) {
  const s = useWellbeingStyles();
  return <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.choices}>{values.map((option) => {
    const id = typeof option === 'object' ? option.value : option;
    const text = typeof option === 'object' ? option.label : LABELS[id] || String(id);
    return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`${label}: ${text}`} accessibilityState={{ selected: value === id }} onPress={() => onChange(optional && value === id ? null : id)} style={[s.chip, value === id && s.selected]}><Text style={[s.chipText, value === id && s.selectedText]}>{text}</Text></Pressable>;
  })}</View></View>;
}
export function WellbeingGate({ navigation, title, children }) {
  const { ready, allowed, recheckAccess, error, verifyFailed } = useWellbeing();
  const s = useWellbeingStyles();
  if (ready && allowed) return children;
  if (!ready && !error) return <AppScreen><AppHeader title={title} onBack={() => navigation.goBack()} /><AppCard><ActivityIndicator /><Text style={s.body}>Se încarcă datele de pe telefon…</Text></AppCard></AppScreen>;
  // A failed check is not a missing subscription; say which one it is.
  const copy = error && !ready
    ? ['Datele nu au putut fi încărcate', error]
    : verifyFailed
      ? ['Nu am putut verifica abonamentul', 'Nu ne-am putut conecta la server. Verifică conexiunea la internet și încearcă din nou. Datele salvate pe telefon se păstrează.']
      : ['Disponibil cu abonament', 'Exercițiile SOS și jurnalul sunt incluse în abonamentele plătite. Datele salvate pe telefon se păstrează.'];
  const recheck = <AppButton title="Încearcă din nou" variant={verifyFailed ? undefined : 'ghost'} onPress={recheckAccess} />;
  const plans = <AppButton title="Vezi abonamente" variant={verifyFailed ? 'ghost' : undefined} onPress={() => navigation.navigate('Subscriptions')} />;
  return <AppScreen><AppHeader title={title} onBack={() => navigation.goBack()} /><AppCard><Text style={s.heading}>{copy[0]}</Text><Text style={s.body}>{copy[1]}</Text>{verifyFailed ? <>{recheck}{plans}</> : <>{plans}{recheck}</>}</AppCard></AppScreen>;
}
export function PrivacyNotice() {
  const s = useWellbeingStyles();
  return <Text style={s.muted}>Check-in-urile, contextele și feedback-ul SOS se sincronizează în cont și pot fi consultate de Dan. Notițele și contactele kitului rămân pe acest telefon.</Text>;
}
const styles = (tc) => StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', color: tc('#24384e', 'fg'), marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 24, color: tc('#24384e', 'fg'), marginBottom: 12 },
  muted: { fontSize: 13, lineHeight: 20, color: tc('#5b6a7a', 'fg'), marginVertical: 12 },
  field: { marginBottom: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, borderRadius: 18, borderWidth: 1, borderColor: tc('#d5dae0', 'bg'), backgroundColor: tc('#f3f4f6', 'bg') },
  selected: { backgroundColor: tc('#24384e', 'bg') },
  chipText: { color: tc('#24384e', 'fg'), fontSize: 15 },
  selectedText: { color: tc('#ffffff', 'fg') },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginVertical: 12 },
  divider: { height: 1, backgroundColor: tc('#d5dae0', 'bg'), marginVertical: 16 },
});

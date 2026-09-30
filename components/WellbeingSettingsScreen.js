import React from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { AppCard, AppHeader, AppScreen } from './ui';
import { Choices, PrivacyNotice, WellbeingGate, useWellbeingStyles } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { useTheme } from './ui/themeContext';

export default function WellbeingSettingsScreen(props) { return <WellbeingGate {...props} title="Setări SOS și check-in"><Settings {...props} /></WellbeingGate>; }
function Settings({navigation}) {
  const { preferences, updatePreferences } = useWellbeing();
  const s = useWellbeingStyles(), {tc} = useTheme();
  const update = (changes) => updatePreferences(changes).catch((error)=>Alert.alert('Setare nesalvată',error.message));
  return <AppScreen><AppHeader title="SOS și check-in" subtitle="Preferințe pentru următorul exercițiu" onBack={()=>navigation.goBack()} /><AppCard>
    <Choices label="Durata SOS" values={[{value:120,label:'2 minute'},{value:180,label:'3 minute'},{value:300,label:'5 minute'}]} value={preferences.duration} optional={false} onChange={(duration)=>update({duration})} />
    <Choices label="Ritm de respirație" values={[{value:'4-6',label:'Inspir 4 · expir 6'},{value:'4-2-6',label:'Inspir 4 · ținut 2 · expir 6'}]} value={preferences.pattern} optional={false} onChange={(pattern)=>update({pattern})} />
    <Text style={s.muted}>Respiră confortabil, fără să forțezi. Poți alege și exercițiul „Observă ce te înconjoară”. Durata și ritmul se aplică la următoarea sesiune.</Text>
    <View style={s.row}><Text style={s.label}>Vibrații ghidate</Text><Switch accessibilityLabel="Vibrații ghidate" value={preferences.haptics} onValueChange={(haptics)=>update({haptics})} /></View>
    <View style={s.row}><Text style={s.label}>Sunet discret</Text><Switch accessibilityLabel="Sunet discret" value={preferences.sound} onValueChange={(sound)=>update({sound})} /></View>
    <Text style={s.label}>Volum: {Math.round(preferences.volume*100)}%</Text><Slider accessibilityLabel="Volumul exercițiului" accessibilityValue={{min:0,max:100,now:Math.round(preferences.volume*100)}} minimumValue={0} maximumValue={1} step={0.05} value={preferences.volume} minimumTrackTintColor={tc('#b3924f','fg')} onSlidingComplete={(volume)=>update({volume})} />
  </AppCard><AppCard><Text style={s.heading}>O invitație discretă</Text><Text style={s.body}>O singură notificare la ora 18:00, după 3 zile fără check-in. Un check-in nou reprogramează invitația.</Text><View style={s.row}><Text style={s.label}>Reminder check-in</Text><Switch accessibilityLabel="Reminder după trei zile fără check-in" value={preferences.reminder} onValueChange={(reminder)=>update({reminder})} /></View><Text style={s.muted}>Se oprește la ieșirea din cont sau la expirarea abonamentului. Este programată local pe acest telefon.</Text></AppCard><PrivacyNotice /></AppScreen>;
}

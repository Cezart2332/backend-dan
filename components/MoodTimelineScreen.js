import React, { useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen } from './ui';
import { useTheme } from './ui/themeContext';
import { Choices, PrivacyNotice, WellbeingGate, useWellbeingStyles } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { LABELS, observedPatterns } from '../utils/wellbeingCore.mjs';

function localDate(row) { return new Date(Date.parse(row.occurredAt) - row.timezoneOffset * 60000); }
function dayKey(row) { return localDate(row).toISOString().slice(0, 10); }
function time(row) { return localDate(row).toISOString().slice(11, 16); }
export default function MoodTimelineScreen(props) { return <WellbeingGate {...props} title="Starea mea în timp"><Timeline {...props} /></WellbeingGate>; }
function Timeline({ navigation }) {
  const { data, refresh, error } = useWellbeing();
  const s = useWellbeingStyles(), { tc } = useTheme();
  const [period, setPeriod] = useState(7);
  const [kind, setKind] = useState('checkins');
  const [limit, setLimit] = useState(50);
  const [refreshing, setRefreshing] = useState(false);
  const filtered = useMemo(() => [...data[kind]].filter((row) => period === 'all' || Date.parse(row.occurredAt) >= Date.now() - period * 86400000).sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)), [data, kind, period]);
  const entries = [...data.checkins].filter((row) => period === 'all' || Date.parse(row.occurredAt) >= Date.now() - period * 86400000);
  const patterns = observedPatterns(entries);
  const sections = [];
  for (const row of filtered.slice(0, limit)) {
    const title = dayKey(row);
    let section = sections.find((group) => group.title === title);
    if (!section) { section = { title, data: [] }; sections.push(section); }
    section.data.push(row);
  }
  const chart = [];
  for (const row of entries) {
    const day = dayKey(row);
    let group = chart.find((item) => item.day === day);
    if (!group) { group = { day, sum: 0, count: 0 }; chart.push(group); }
    group.sum += row.level; group.count += 1;
  }
  chart.sort((a,b) => a.day.localeCompare(b.day));
  const header = <>
    <Choices label="Perioadă" values={[{value:7,label:'7 zile'},{value:30,label:'30 zile'},{value:'all',label:'Tot istoricul'}]} value={period} optional={false} onChange={(v) => {setPeriod(v); setLimit(50);}} />
    <Choices label="Istoric" values={[{value:'checkins',label:'Check-in-uri'},{value:'sessions',label:'Sesiuni SOS'}]} value={kind} optional={false} onChange={(v) => {setKind(v); setLimit(50);}} />
    <AppButton title="Check-in rapid" icon="plus" onPress={() => navigation.navigate('CheckIn')} />
    {error && <Text style={s.muted}>Datele sunt salvate pe telefon. Sincronizarea va fi reîncercată: {error}</Text>}
    {kind === 'checkins' && <AppCard><Text style={s.heading}>Nivelul raportat</Text><Text style={s.muted}>Medii zilnice · ultimele {Math.min(14, chart.length)} zile cu raportări din perioada aleasă</Text>
      {chart.slice(-14).map((item) => { const average = item.sum / item.count; return <View key={item.day} accessible accessibilityLabel={`${item.day}: medie ${average.toFixed(1)} din 10, ${item.count} check-in-uri`} style={{ marginVertical: 8 }}><Text style={s.body}>{item.day} · {average.toFixed(1)}/10</Text><View accessible={false} style={{height:8,borderRadius:4,backgroundColor:tc('#e8ebef','bg')}}><View style={{height:8,borderRadius:4,width:`${average*10}%`,backgroundColor:tc('#b3924f','fg')}} /></View></View>; })}
      {!chart.length && <Text style={s.body}>Primul check-in va apărea aici.</Text>}
    </AppCard>}
    {kind === 'checkins' && <AppCard><Text style={s.heading}>Observații din raportările tale</Text><Text style={s.muted}>{period === 'all' ? 'Tot istoricul' : `Ultimele ${period} zile`} · {entries.length} check-in-uri. Aceste comparații descriu raportările, fără diagnostic sau concluzii despre cauze.</Text>{patterns.map((item) => <View key={item.title}><Text style={s.label}>{item.title}</Text><Text style={s.body}>{item.text}</Text></View>)}{!patterns.length && <Text style={s.body}>Nu sunt încă suficiente observații sau diferențe consistente pentru comparații.</Text>}</AppCard>}
    <PrivacyNotice /><AppButton title="Jurnalul meu" variant="ghost" onPress={() => navigation.navigate('ProgressHistory')} />
  </>;
  return <AppScreen scroll={false}><AppHeader title="Starea mea în timp" onBack={() => navigation.goBack()} /><SectionList
    sections={sections} keyExtractor={(row) => row.clientId} stickySectionHeadersEnabled={false}
    ListHeaderComponent={header} refreshing={refreshing} onRefresh={async () => {setRefreshing(true); try { await refresh(); } finally {setRefreshing(false);} }}
    renderSectionHeader={({section}) => <Text style={s.heading}>{section.title}</Text>}
    renderItem={({item}) => <AppCard><Text style={s.label}>{time(item)} · {kind === 'checkins' ? `${item.level}/10` : `${item.status === 'completed' ? 'Încheiat' : 'Oprit'} · ${Math.round(item.elapsedMs/1000)} secunde`}</Text>
      {kind === 'checkins' ? <><Text style={s.body}>{item.note || 'Check-in rapid'}</Text><Text style={s.muted}>{[['Context',item.context],['Somn',item.sleep],['Cafeină',item.caffeine],['Activitate',item.activity]].filter(([,v]) => v).map(([label,v]) => `${label}: ${LABELS[v]}`).join(' · ') || 'Fără contexte suplimentare'}</Text></> : <><Text style={s.body}>{item.techniques.map((value) => LABELS[value]).join(' · ')}</Text><Text style={s.muted}>{LABELS[item.feedback?.rating] || 'Fără evaluare'}{item.feedback?.level ? ` · ${item.feedback.level}/10` : ''}{item.feedback?.context ? ` · ${LABELS[item.feedback.context]}` : ''}</Text></>}
      <Text style={s.muted}>{item.pending ? 'Salvat pe telefon · în așteptarea sincronizării' : 'Sincronizat în cont'}</Text>
    </AppCard>}
    ListEmptyComponent={<Text style={s.body}>Nu există intrări în această perioadă.</Text>}
    ListFooterComponent={filtered.length > limit ? <AppButton title="Încarcă încă 50" variant="ghost" onPress={() => setLimit(limit+50)} /> : <View style={{height:24}} />}
  /></AppScreen>;
}

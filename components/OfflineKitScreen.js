import React, { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen, AppTextField } from './ui';
import { WellbeingGate, useWellbeingStyles } from './WellbeingUI';
import { useWellbeing } from '../contexts/WellbeingContext';
import { LABELS } from '../utils/wellbeingCore.mjs';

export default function OfflineKitScreen(props) { return <WellbeingGate {...props} title="Kitul meu offline"><Kit {...props} /></WellbeingGate>; }
function Kit({ navigation }) {
  const { data, updateKit } = useWellbeing();
  const s = useWellbeingStyles();
  const [draft, setDraft] = useState(data.kit);
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  async function commit(next) {
    setSaving(true);
    try { await updateKit(next); setDraft(next); setDirty(false); return true; }
    catch (error) { Alert.alert('Nu am putut salva', error.message); return false; }
    finally { setSaving(false); }
  }
  const addContact = async () => {
    const normalized = phone.replace(/[\s()\-]/g, '');
    if (!name.trim() || !/^\+?[0-9]{3,20}$/.test(normalized)) return Alert.alert('Contact incomplet', 'Completează un nume și un număr de telefon valid.');
    if (draft.contacts.length >= 10) return Alert.alert('Maximum 10 contacte', 'Elimină un contact înainte să adaugi altul.');
    if (await commit({ ...draft, contacts: [...draft.contacts, { name: name.trim(), phone: normalized }] })) { setName(''); setPhone(''); }
  };
  return <AppScreen keyboard><AppHeader title="Kitul meu offline" subtitle="Lucrurile importante, la îndemână" onBack={() => {
    if (!dirty) return navigation.goBack();
    Alert.alert('Notiță nesalvată', 'Salvează înainte de a ieși?', [{text:'Continuă editarea',style:'cancel'},{text:'Ieși',onPress:()=>navigation.goBack()},{text:'Salvează',onPress:async()=>{if(await commit(draft))navigation.goBack();}}]);
  }} />
    <AppCard><Text style={s.heading}>Exerciții incluse pe telefon</Text><Text style={s.muted}>Respirația, exercițiul „Observă ce te înconjoară” și sunetele sunt disponibile fără internet, cât timp abonamentul confirmat este valabil.</Text>
      {['breathing','grounding'].sort((a,b)=>Number(draft.favorites.includes(b))-Number(draft.favorites.includes(a))).map((technique) => <View key={technique} style={s.field}>
        <AppButton title={LABELS[technique]} onPress={() => navigation.navigate('Panic', { mode: technique })} />
        <AppButton title={draft.favorites.includes(technique) ? '★ Favorit · elimină' : 'Adaugă la favorite'} variant="ghost" disabled={saving} onPress={() => commit({ ...draft, favorites: draft.favorites.includes(technique) ? draft.favorites.filter((v)=>v!==technique) : [...draft.favorites,technique] })} />
      </View>)}
    </AppCard>
    <AppCard><AppTextField label="Notițele mele de sprijin" multiline maxLength={4000} value={draft.notes} onChangeText={(notes)=>{setDraft({...draft,notes});setDirty(true);}} placeholder="Ce vreau să-mi amintesc într-un moment dificil…" /><Text style={s.muted}>Notițele și contactele rămân pe acest telefon, în contul tău. Nu sunt trimise către Dan.</Text><AppButton title="Salvează notița" loading={saving} onPress={()=>commit(draft)} /></AppCard>
    <AppCard><Text style={s.heading}>Contactele mele de sprijin</Text>{draft.contacts.map((contact,index)=><View key={`${contact.phone}:${index}`} style={s.field}><Text style={s.label}>{contact.name} · {contact.phone}</Text><AppButton title={`Sună: ${contact.name}`} icon="phone" onPress={()=>Linking.openURL(`tel:${contact.phone}`).catch(()=>Alert.alert('Apel indisponibil','Nu am putut deschide aplicația de telefon.'))} /><AppButton title="Elimină contactul" variant="ghost" disabled={saving} onPress={()=>commit({...draft,contacts:draft.contacts.filter((_,i)=>i!==index)})} /></View>)}
      <AppTextField label="Nume" maxLength={80} value={name} onChangeText={setName} /><AppTextField label="Telefon" keyboardType="phone-pad" maxLength={30} value={phone} onChangeText={setPhone} /><AppButton title="Adaugă contact" loading={saving} onPress={addContact} /><Text style={s.muted}>Apelurile necesită serviciul de telefonie al dispozitivului.</Text>
    </AppCard>
  </AppScreen>;
}

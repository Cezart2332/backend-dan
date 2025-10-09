import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingQuestionsScreen({ navigation }) {
  const questions = useMemo(() => ([
    {
      id: 1,
      type: 'single',
      text: 'Cât de des simți anxietatea în viața ta?',
      options: [
        'Zilnic sau aproape zilnic',
        'De câteva ori pe săptămână',
        'Doar în situații dificile',
        'Destul de rar sau aproape niciodată',
      ],
    },
    {
      id: 2,
      type: 'multi',
      text: 'Ce ai încercat până acum pentru a te elibera de anxietate?',
      options: [
        'Medicamente prescrise (de medic psihiatru)',
        'Psihoterapie (terapie cognitiv-comportamentală, psihanaliză etc.)',
        'Coaching sau ghidaj personal',
        'Tehnici de relaxare (respirație, meditație, yoga etc.)',
        'Sport sau activități fizice',
        'Lectură / resurse online / cărți',
        'Sprijinul unei persoane apropiate',
        'Nu am încercat nimic până acum',
      ],
    },
    {
      id: 3,
      type: 'multi',
      text: 'Care crezi că este cel mai mare obstacol pentru tine în vindecarea de anxietate?',
      options: [
        'Frica de simptomele fizice si psihologice',
        'Gândurile negative și catastrofice',
        'Teama de a pierde controlul',
        'Lipsa de susținere din jur și/sau teama să nu fiu judecat de ceilalți',
        'Teama că rămân blocat(ă) pentru totdeauna',
        'Altceva',
      ],
    },
    {
      id: 4,
      type: 'single',
      text: 'Salut! Eu sunt Dan, un fost anxios. Din experiența mea am scris două cărți despre cum am reușit să mă eliberez de anxietate. Tu ai apucat să le citești?',
      options: [
        'Da, am citit ambele și m-au ajutat enorm',
        'Da, am citit una dintre ele și mi-a fost de folos',
        'Da, am citit, dar încă simt că am nevoie de mai mult sprijin',
        'Nu, dar vreau să le descopăr cât mai curând',
        'Nu, nu știam de ele până acum',
        'Nu, dar mi-ar plăcea să aflu prin această aplicație ce pot face mai mult pentru mine',
      ],
    },
    {
      id: 5,
      type: 'multi',
      text: 'Ce ți-ar plăcea să fac eu, Dan, prin această aplicație pentru tine?',
      options: [
        'Să mă ghidezi pas cu pas pentru a scăpa de anxietate',
        'Să îmi arăți cum să gestionez gândurile anxioase atunci când apar',
        'Să mă înveți exerciții practice pentru liniștire și echilibru',
        'Să îmi dai motivație și încredere în mine, chiar și în zilele grele',
        'Să îmi explici, pe înțeles, ce se întâmplă cu mintea și corpul în anxietate',
        'Să mă ajuți să îmi schimb relația cu anxietatea și să o văd altfel',
        'Să îmi oferi exemple și povești reale care să mă inspire',
        'Să am acces la un plan clar, ca să știu mereu următorul pas',
        'Să simt că nu sunt singur(ă) și că am sprijin constant',
        'Altceva – am propria mea nevoie',
      ],
    },
  ]), []);

  const [answers, setAnswers] = useState(
    () => questions.map(q => (q.type === 'single' ? null : []))
  );

  const toggleSelect = (qIndex, oIndex) => {
    const q = questions[qIndex];
    if (q.type === 'single') {
      const next = [...answers];
      next[qIndex] = oIndex;
      setAnswers(next);
    } else {
      const next = answers.map((a, i) => (i === qIndex ? [...a] : a));
      const arr = next[qIndex];
      const existing = arr.indexOf(oIndex);
      if (existing >= 0) {
        arr.splice(existing, 1);
      } else {
        arr.push(oIndex);
      }
      setAnswers(next);
    }
  };

  const isSelected = (qIndex, oIndex) => {
    const q = questions[qIndex];
    const a = answers[qIndex];
    return q.type === 'single' ? a === oIndex : Array.isArray(a) && a.includes(oIndex);
  };

  const allAnswered = answers.every((a, i) => {
    const q = questions[i];
    return q.type === 'single' ? a !== null : Array.isArray(a) && a.length > 0;
  });

  const handleContinue = () => {
    if (!allAnswered) return;
    // Persist answers if needed (e.g., AsyncStorage or API)
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Întrebări inițiale</Text>
            <Text style={styles.subtitle}>Răspunde pentru a-ți personaliza experiența</Text>
          </View>

          {questions.map((q, qi) => (
            <View key={qi} style={styles.card}>
              <Text style={styles.question}>{qi + 1}. {q.text}</Text>
              <View style={styles.optionsCol}>
                {q.options.map((opt, oi) => {
                  const selected = isSelected(qi, oi);
                  const isMulti = q.type === 'multi';
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.choice, selected && styles.choiceSelected]}
                      onPress={() => toggleSelect(qi, oi)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.choiceIcon]}>{isMulti ? (selected ? '☑' : '☐') : (selected ? '●' : '○')}</Text>
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.continueBtn, !allAnswered && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!allAnswered}
          >
            <LinearGradient colors={['#4a90e2', '#357abd']} style={styles.continueGradient}>
              <Text style={styles.continueText}>Continuă</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { padding: 20 },
  header: { marginBottom: 10, alignItems: 'center' },
  backButton: {
    position: 'absolute', left: 0, top: -2, padding: 8, borderRadius: 20, backgroundColor: '#fff',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  backButtonText: { fontSize: 18, color: '#4a90e2', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: '700', color: '#2c3e50', marginTop: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c7b84', marginTop: 6, marginBottom: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginVertical: 10,
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: '#e8f4fd'
  },
  question: { fontSize: 16, color: '#2c3e50', marginBottom: 12, lineHeight: 22 },
  optionsCol: { marginTop: 8 },
  choice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e8f4fd',
    paddingVertical: 10, paddingHorizontal: 12, marginVertical: 6,
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  choiceSelected: { backgroundColor: '#eaf3ff', borderColor: '#cfe6ff' },
  choiceIcon: { width: 22, textAlign: 'center', marginRight: 8, marginTop: 2 },
  choiceText: { flex: 1, color: '#2c3e50', fontSize: 14, lineHeight: 20 },
  choiceTextSelected: { color: '#1f4b7a' },
  continueBtn: { marginTop: 10, borderRadius: 16, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.6 },
  continueGradient: { paddingVertical: 16, alignItems: 'center' },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

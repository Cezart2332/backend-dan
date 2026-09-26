import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from './ui/themeContext';

export default function OnboardingQuestionsScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
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
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
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
                      <Ionicons
                        name={isMulti ? (selected ? 'checkbox-outline' : 'square-outline') : (selected ? 'radio-button-on' : 'radio-button-off')}
                        size={20}
                        color={selected ? tc('#24384e', 'fg') : tc('#9aa5b1', 'fg')}
                        style={{ marginRight: 8, marginTop: 1 }}
                      />
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
            <View style={styles.continueInner}>
              <Text style={styles.continueText}>Continuă</Text>
              <Feather name="arrow-right" size={18} color={tc("#fff", 'fg')} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tc('#f6f7f8', 'bg') },
  background: { flex: 1 },
  scroll: { padding: 20 },
  header: { marginBottom: 14, alignItems: 'center' },
  backButton: {
    position: 'absolute', left: 0, top: 0, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  title: { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", letterSpacing: 0.2, fontSize: 22, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginTop: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: tc('#5b6a7a', 'fg'), marginTop: 6, marginBottom: 8, textAlign: 'center' },
  card: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 18, padding: 18, marginVertical: 10,
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  question: { fontSize: 15, color: tc('#1c2b3a', 'fg'), marginBottom: 12, lineHeight: 22, fontWeight: '600' },
  optionsCol: { marginTop: 6 },
  choice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'), borderRadius: 12,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    paddingVertical: 10, paddingHorizontal: 12, marginVertical: 5,
  },
  choiceSelected: { backgroundColor: tc('rgba(36,56,78,0.1)', 'bg'), borderColor: tc('rgba(36,56,78,0.24)', 'bg') },
  choiceText: { flex: 1, color: tc('#1c2b3a', 'fg'), fontSize: 14, lineHeight: 20 },
  choiceTextSelected: { color: tc('#1c2b3a', 'fg'), fontWeight: '500' },
  continueBtn: { marginTop: 12, borderRadius: 16 },
  continueBtnDisabled: { opacity: 0.5 },
  continueInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: tc('#24384e', 'bg'), borderRadius: 16, paddingVertical: 16,
  },
  continueText: { color: tc('#fff', 'fg'), fontSize: 16, fontWeight: '600' },
});

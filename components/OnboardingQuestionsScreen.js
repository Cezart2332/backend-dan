import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const options = [
  'Total dezacord',
  'Dezacord',
  'Nici acord, nici dezacord',
  'Acord',
  'Total de acord',
];

const initialAnswers = [null, null, null, null, null];

export default function OnboardingQuestionsScreen({ navigation }) {
  const [answers, setAnswers] = useState(initialAnswers);

  const questions = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit?',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua?',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat?',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur?',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum?',
  ];

  const selectOption = (qIndex, oIndex) => {
    const next = [...answers];
    next[qIndex] = oIndex;
    setAnswers(next);
  };

  const allAnswered = answers.every((a) => a !== null);

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
            <Text style={styles.subtitle}>Alege o opțiune pentru fiecare afirmație</Text>
          </View>

          {questions.map((q, qi) => (
            <View key={qi} style={styles.card}>
              <Text style={styles.question}>{qi + 1}. {q}</Text>
              <View style={styles.optionsRow}>
                {options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => selectOption(qi, oi)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {oi + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.legendRow}>
                <Text style={styles.legendText}>{options[0]}</Text>
                <Text style={styles.legendText}>{options[4]}</Text>
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
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  option: {
    width: 52, height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8f4fd',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4a90e2', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
  },
  optionSelected: { backgroundColor: '#4a90e2', borderColor: 'transparent', shadowOpacity: 0.2, elevation: 6 },
  optionText: { color: '#2c3e50', fontWeight: '600' },
  optionTextSelected: { color: '#fff' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendText: { fontSize: 12, color: '#6c7b84' },
  continueBtn: { marginTop: 10, borderRadius: 16, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.6 },
  continueGradient: { paddingVertical: 16, alignItems: 'center' },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

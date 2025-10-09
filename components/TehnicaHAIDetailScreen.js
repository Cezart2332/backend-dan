import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

export default function TehnicaHAIDetailScreen({ navigation, route }) {
  const { title, description, note } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f0f8ff', '#e6f3ff', '#ffffff']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{title || 'Tehnica HAI'}</Text>
          {description ? <Text style={styles.paragraph}>{description}</Text> : null}
          {note ? <Text style={[styles.paragraph, styles.note]}>{note}</Text> : null}
          {!description && !note ? (
            <Text style={styles.paragraph}>
              Conținutul pentru această secțiune va fi disponibil în curând. Între timp, te
              încurajez să îți rezervi câteva minute pentru a trece prin pașii principali ai
              tehnicii HAI și să îi aplici în situațiile tale zilnice.
            </Text>
          ) : null}

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Înapoi</Text>
          </TouchableOpacity>
        </ScrollView>
        <HeadphonesDisclaimer visibleInitially={false} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'center',
  },
  note: {
    fontStyle: 'italic',
    color: '#4a90e2',
  },
  backBtn: {
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  backText: { color: '#2c3e50', fontWeight: '600' },
});

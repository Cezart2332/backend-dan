import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addEntry, getUnsyncedEntries, markEntrySynced, setBackendReady } from '../utils/progressStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';

const { width } = Dimensions.get('window');

export default function ProgressScreen({ navigation }) {
  const [anxietyLevel, setAnxietyLevel] = useState(0);
  const [feelings, setFeelings] = useState('');
  const [recentActions, setRecentActions] = useState('');
  // On mount, if token exists, attempt to sync any unsynced local entries
  React.useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const unsynced = await getUnsyncedEntries();
        for (const e of unsynced) {
          const res = await api.createProgress({ level: e.level, description: e.description, actions: e.actions, date: e.date }, token);
          if (res?.id) await markEntrySynced(e.localId || e.id, res.id);
        }
        await setBackendReady(true);
      } catch {}
    })();
  }, []);

  const handleAnxietyLevelPress = (level) => {
    setAnxietyLevel(level);
  };

  const handleSendJournal = async () => {
    if (anxietyLevel === 0) {
      alert('Te rog să selectezi nivelul de anxietate');
      return;
    }
    if (!feelings.trim()) {
      alert('Te rog să completezi cum te-ai simțit');
      return;
    }
    
    const entry = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      level: anxietyLevel,
      description: feelings.trim(),
      actions: recentActions.trim(),
    };
    try {
      const token = await getToken();
      if (token) {
        await api.createProgress({ level: entry.level, description: entry.description, actions: entry.actions, date: entry.date }, token);
      }
      // Always keep local copy too
      await addEntry(entry);
      alert('Jurnalul a fost trimis cu succes către Dan!');
    } catch (e) {
      alert(e?.message || 'Nu am reușit să trimit progresul.');
    }
    
    // Reset form
    setAnxietyLevel(0);
    setFeelings('');
    setRecentActions('');
  };

  const getAnxietyColor = (level) => {
    if (level <= 3) return '#5cb85c'; // Green
    if (level <= 6) return '#f0ad4e'; // Orange
    return '#d9534f'; // Red
  };

  const getAnxietyLabel = (level) => {
    if (level <= 3) return 'Calm';
    if (level <= 6) return 'Moderat';
    return 'Intens';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#ddeeff', '#eaf4ff', '#f5f9ff']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color="#4a90e2" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Ionicons name="bar-chart-outline" size={36} color="#4a90e2" />
              </View>
              <Text style={styles.title}>Progresul Meu</Text>
              <Text style={styles.subtitle}>Urmărește-ți evoluția zilnică</Text>
            </View>

            <TouchableOpacity style={styles.headerAction} onPress={() => navigation.navigate('ProgressHistory')}>
              <View style={styles.headerActionInner}>
                <Ionicons name="time-outline" size={16} color="#4a90e2" style={{ marginRight: 6 }} />
                <Text style={styles.headerActionText}>Vezi istoric</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Anxiety Level Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nivel de anxietate</Text>
            <Text style={styles.sectionSubtitle}>Selectează nivelul tău actual (1-10)</Text>
            
            <View style={styles.anxietyLevels}>
              <View style={styles.anxietyRow}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.anxietyButton,
                      anxietyLevel === level && styles.anxietyButtonSelected,
                      anxietyLevel === level && { backgroundColor: getAnxietyColor(level) }
                    ]}
                    onPress={() => handleAnxietyLevelPress(level)}
                  >
                    <Text style={[
                      styles.anxietyButtonText,
                      anxietyLevel === level && styles.anxietyButtonTextSelected
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.anxietyRow}>
                {[6, 7, 8, 9, 10].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.anxietyButton,
                      anxietyLevel === level && styles.anxietyButtonSelected,
                      anxietyLevel === level && { backgroundColor: getAnxietyColor(level) }
                    ]}
                    onPress={() => handleAnxietyLevelPress(level)}
                  >
                    <Text style={[
                      styles.anxietyButtonText,
                      anxietyLevel === level && styles.anxietyButtonTextSelected
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {anxietyLevel > 0 && (
              <View style={styles.anxietyFeedback}>
                <Text style={[styles.anxietyLabel, { color: getAnxietyColor(anxietyLevel) }]}>
                  Nivel {anxietyLevel}/10 - {getAnxietyLabel(anxietyLevel)}
                </Text>
              </View>
            )}
          </View>

          {/* Feelings Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cum te-ai simțit?</Text>
            <Text style={styles.sectionSubtitle}>Descrie pe scurt starea ta de azi</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.feelingsInput}
                placeholder="Ex: M-am simțit mai calm după exercițiile de respirație..."
                placeholderTextColor="#a0c4e8"
                value={feelings}
                onChangeText={setFeelings}
                multiline
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.characterCount}>{feelings.length}/200</Text>
            </View>
          </View>

          {/* Recent Actions Text Area */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cele mai recente acțiuni</Text>
            <Text style={styles.sectionSubtitle}>Ce ai făcut pentru a-ți gestiona anxietatea?</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.actionsInput}
                placeholder="Ex: Am practicat tehnici de respirație, am făcut o plimbare, am meditat 10 minute..."
                placeholderTextColor="#a0c4e8"
                value={recentActions}
                onChangeText={setRecentActions}
                multiline
                textAlignVertical="top"
                maxLength={300}
              />
              <Text style={styles.characterCount}>{recentActions.length}/300</Text>
            </View>
          </View>

          {/* Progress Insights */}
          <View style={styles.insightsSection}>
            <View style={styles.insightsCard}>
              <Ionicons name="bulb-outline" size={28} color="#f0ad4e" style={{ marginBottom: 8 }} />
              <Text style={styles.insightsTitle}>Sfat pentru astăzi</Text>
              <Text style={styles.insightsText}>
                {anxietyLevel <= 3 
                  ? "Excelent! Continua cu rutina care te ajută să rămâi calm."
                  : anxietyLevel <= 6
                  ? "Este normal să simți anxietate uneori. Încearcă exerciții de respirație."
                  : "Ia-ți timp să te relaxezi. Consideră să vorbești cu cineva de încredere."
                }
              </Text>
            </View>
          </View>

          {/* Send Journal Button */}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendJournal}
          >
            <LinearGradient
              colors={['#4a90e2', '#357abd']}
              style={styles.sendButtonGradient}
            >
              <Ionicons name="pencil-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.sendButtonText}>Trimite jurnal către Dan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ddeeff',
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 10,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 18,
    color: '#4a90e2',
  },
  headerAction: {
    position: 'absolute',
    right: 0,
    top: 10,
  },
  headerActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  headerActionText: {
    color: '#4a90e2',
    fontWeight: '600',
    fontSize: 13,
  },
  headerIconText: {
    fontSize: 35,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a2d45',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c8096',
    textAlign: 'center',
    fontWeight: '400',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2d45',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6c8096',
    marginBottom: 14,
  },
  anxietyLevels: {
    marginBottom: 15,
  },
  anxietyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  anxietyButton: {
    width: (width - 80) / 5 - 4,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(200,220,240,0.6)',
  },
  anxietyButtonSelected: {
    shadowOpacity: 0.2,
    elevation: 6,
    borderColor: 'transparent',
  },
  anxietyButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a2d45',
  },
  anxietyButtonTextSelected: {
    color: '#ffffff',
  },
  anxietyFeedback: {
    alignItems: 'center',
    marginTop: 10,
  },
  anxietyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,220,240,0.6)',
  },
  feelingsInput: {
    fontSize: 15,
    color: '#1a2d45',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsInput: {
    fontSize: 15,
    color: '#1a2d45',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6c7b84',
    textAlign: 'right',
    marginTop: 8,
  },
  insightsSection: {
    marginBottom: 25,
  },
  insightsCard: {
    borderRadius: 18,
    padding: 20,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(200,220,240,0.6)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  insightsIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a2d45',
    marginBottom: 8,
    textAlign: 'center',
  },
  insightsText: {
    fontSize: 14,
    color: '#6c8096',
    textAlign: 'center',
    lineHeight: 20,
  },
  sendButton: {
    marginBottom: 25,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  sendButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

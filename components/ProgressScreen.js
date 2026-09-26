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
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { addEntry, getUnsyncedEntries, markEntrySynced, setBackendReady } from '../utils/progressStorage';
import { getToken } from '../utils/authStorage';
import { api } from '../utils/api';
import { useTheme, useThemedStyles } from './ui/themeContext';
import { hapticNotify } from '../utils/haptics';

const { width } = Dimensions.get('window');

export default function ProgressScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
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
      Alert.alert('Nivel lipsă', 'Te rog să selectezi nivelul de anxietate.');
      return;
    }
    if (!feelings.trim()) {
      Alert.alert('Descriere lipsă', 'Te rog să completezi cum te-ai simțit.');
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
      hapticNotify('success');
      Alert.alert('Jurnal trimis', 'Jurnalul a fost trimis către Dan.');
    } catch (e) {
      Alert.alert('Eroare', e?.message || 'Nu am reușit să trimit progresul.');
    }
    
    // Reset form
    setAnxietyLevel(0);
    setFeelings('');
    setRecentActions('');
  };

  const getAnxietyColor = (level) => {
    if (level <= 3) return tc('#3d7d5f', 'bg'); // Green
    if (level <= 6) return tc('#b07e3e', 'bg'); // Orange
    return tc('#a8544c', 'bg'); // Red
  };

  const getAnxietyLabel = (level) => {
    if (level <= 3) return 'Calm';
    if (level <= 6) return 'Moderat';
    return 'Intens';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi"
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
              style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Feather name="bar-chart-2" size={36} color={tc("#24384e", 'fg')} />
              </View>
              <Text style={styles.title}>Progresul Meu</Text>
              <Text style={styles.subtitle}>Urmărește-ți evoluția zilnică</Text>
            </View>

            <TouchableOpacity style={styles.headerAction} onPress={() => navigation.navigate('ProgressHistory')}>
              <View style={styles.headerActionInner}>
                <Feather name="clock" size={16} color={tc("#24384e", 'fg')} style={{ marginRight: 6 }} />
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
                placeholderTextColor={tc("#8a97a5", 'fg')}
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
                placeholderTextColor={tc("#8a97a5", 'fg')}
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
              <Feather name="zap" size={28} color={tc("#b07e3e", 'fg')} style={{ marginBottom: 8 }} />
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
              colors={[tc('rgba(28,43,58,0.94)', 'bg'), tc('rgba(22,34,47,0.96)', 'bg')]}
              style={styles.sendButtonGradient}
            >
              <Feather name="edit-2" size={20} color={tc("#fff", 'fg')} style={{ marginRight: 8 }} />
              <Text style={styles.sendButtonText}>Trimite jurnal către Dan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (tc) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc('#f6f7f8', 'bg'),
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
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 18,
    color: tc('#24384e', 'fg'),
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
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
  },
  headerActionText: {
    color: tc('#24384e', 'fg'),
    fontWeight: '600',
    fontSize: 13,
  },
  headerIconText: {
    fontSize: 35,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 28,
    fontWeight: '700',
    color: tc('#1c2b3a', 'fg'),
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: tc('#5b6a7a', 'fg'),
    textAlign: 'center',
    fontWeight: '400',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tc('#1c2b3a', 'fg'),
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: tc('#5b6a7a', 'fg'),
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
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  anxietyButtonSelected: {
    shadowOpacity: 0.2,
    elevation: 6,
    borderColor: 'transparent',
  },
  anxietyButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tc('#1c2b3a', 'fg'),
  },
  anxietyButtonTextSelected: {
    color: tc('#ffffff', 'fg'),
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
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    borderRadius: 18,
    padding: 16,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  feelingsInput: {
    fontSize: 15,
    color: tc('#1c2b3a', 'fg'),
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsInput: {
    fontSize: 15,
    color: tc('#1c2b3a', 'fg'),
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: tc('#5b6a7a', 'fg'),
    textAlign: 'right',
    marginTop: 8,
  },
  insightsSection: {
    marginBottom: 25,
  },
  insightsCard: {
    borderRadius: 18,
    padding: 20,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    alignItems: 'center',
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
  },
  insightsIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tc('#1c2b3a', 'fg'),
    marginBottom: 8,
    textAlign: 'center',
  },
  insightsText: {
    fontSize: 14,
    color: tc('#5b6a7a', 'fg'),
    textAlign: 'center',
    lineHeight: 20,
  },
  sendButton: {
    marginBottom: 25,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#24384e',
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
    color: tc('#ffffff', 'fg'),
    fontSize: 18,
    fontWeight: '600',
  },
});

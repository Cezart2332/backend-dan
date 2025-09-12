import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ProgressScreen({ navigation }) {
  const [anxietyLevel, setAnxietyLevel] = useState(0);
  const [feelings, setFeelings] = useState('');
  const [recentActions, setRecentActions] = useState('');

  const handleAnxietyLevelPress = (level) => {
    setAnxietyLevel(level);
  };

  const handleSendJournal = () => {
    if (anxietyLevel === 0) {
      alert('Te rog să selectezi nivelul de anxietate');
      return;
    }
    if (!feelings.trim()) {
      alert('Te rog să completezi cum te-ai simțit');
      return;
    }
    
    // Here you would typically send the data to a server or save locally
    console.log('Sending journal:', {
      anxietyLevel,
      feelings,
      recentActions,
      timestamp: new Date().toISOString()
    });
    
    alert('Jurnalul a fost trimis cu succes către Dan! 📝✨');
    
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
        colors={['#f0f8ff', '#e6f3ff', '#ffffff']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>📊</Text>
              </View>
              <Text style={styles.title}>Progresul Meu</Text>
              <Text style={styles.subtitle}>Urmărește-ți evoluția zilnică</Text>
            </View>
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
            <LinearGradient
              colors={['#ffffff', '#f8fdff']}
              style={styles.insightsCard}
            >
              <Text style={styles.insightsIcon}>💡</Text>
              <Text style={styles.insightsTitle}>Sfat pentru astăzi</Text>
              <Text style={styles.insightsText}>
                {anxietyLevel <= 3 
                  ? "Excelent! Continua cu rutina care te ajută să rămâi calm."
                  : anxietyLevel <= 6
                  ? "Este normal să simți anxietate uneori. Încearcă exerciții de respirație."
                  : "Ia-ți timp să te relaxezi. Consideră să vorbești cu cineva de încredere."
                }
              </Text>
            </LinearGradient>
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
              <Text style={styles.sendButtonIcon}>📝</Text>
              <Text style={styles.sendButtonText}>Trimite jurnal către Dan</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Weekly Progress Overview */}
          <View style={styles.weeklySection}>
            <Text style={styles.weeklySectionTitle}>Progresul acestei săptămâni</Text>
            <View style={styles.weeklyStats}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>4</Text>
                <Text style={styles.statLabel}>Zile înregistrate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>5.2</Text>
                <Text style={styles.statLabel}>Nivel mediu</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>↓15%</Text>
                <Text style={styles.statLabel}>Îmbunătățire</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#4a90e2',
    fontWeight: 'bold',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerIconText: {
    fontSize: 35,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c7b84',
    textAlign: 'center',
    fontWeight: '400',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c7b84',
    marginBottom: 15,
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
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  anxietyButtonSelected: {
    shadowOpacity: 0.2,
    elevation: 6,
    borderColor: 'transparent',
  },
  anxietyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  feelingsInput: {
    fontSize: 16,
    color: '#2c3e50',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsInput: {
    fontSize: 16,
    color: '#2c3e50',
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
    borderRadius: 16,
    padding: 20,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e8f4fd',
    alignItems: 'center',
  },
  insightsIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  insightsText: {
    fontSize: 14,
    color: '#6c7b84',
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
  weeklySection: {
    marginBottom: 20,
  },
  weeklySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f4fd',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6c7b84',
    fontWeight: '500',
    textAlign: 'center',
  },
});

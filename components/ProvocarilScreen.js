import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { levels as levelDefs } from '../challenges';

const { width } = Dimensions.get('window');

export default function ProvocarilScreen({ navigation }) {
  const [selectedLevel, setSelectedLevel] = useState(null);

  const challengeLevels = useMemo(() => levelDefs.map(l => ({
    id: l.id,
    level: `Nivel ${l.id}`,
    title: l.title,
    subtitle: l.duration,
    goal: l.goal,
    description: l.goal,
    icon: l.id === 1 ? '🌱' : l.id === 2 ? '🌿' : '🔥',
    color: l.color,
    gradientColors: l.gradientColors,
    difficulty: l.difficulty,
    duration: l.duration,
    exercises: l.challenges.length,
  })), [levelDefs]);

  const handleLevelPress = (level) => {
    setSelectedLevel(level.id === selectedLevel ? null : level.id);
  };

  const handleStartChallenge = (level) => {
    navigation.navigate('LevelChallenges', { level });
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
                <Text style={styles.headerIconText}>🎯</Text>
              </View>
              <Text style={styles.title}>Provocări</Text>
              <Text style={styles.subtitle}>Alege-ți nivelul de provocare</Text>
            </View>

            <View style={styles.historyWrap}>
              <TouchableOpacity onPress={() => navigation.navigate('ChallengeHistory')} style={styles.historyButton}>
                <LinearGradient colors={["#4a90e2", "#357abd"]} style={styles.historyButtonGradient}>
                  <Text style={styles.historyIcon}>⏱</Text>
                  <Text style={styles.historyButtonText}>Vezi istoric</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>


          {/* Progress Overview */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Progresul tău</Text>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Completate</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>35</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>0%</Text>
                <Text style={styles.statLabel}>Progres</Text>
              </View>
            </View>
          </View>

          {/* Challenge Levels */}
          <View style={styles.levelsContainer}>
            {challengeLevels.map((level) => (
              <View key={level.id} style={styles.levelCard}>
                <TouchableOpacity
                  style={[
                    styles.levelHeader,
                    selectedLevel === level.id && styles.levelHeaderExpanded
                  ]}
                  onPress={() => handleLevelPress(level)}
                >
                  <LinearGradient
                    colors={['#ffffff', '#f8fdff']}
                    style={styles.levelHeaderGradient}
                  >
                    <View style={styles.levelHeaderContent}>
                      <View style={[styles.levelIconContainer, { backgroundColor: level.color + '15' }]}>
                        <Text style={styles.levelIcon}>{level.icon}</Text>
                      </View>
                      
                      <View style={styles.levelInfo}>
                        <View style={styles.levelTitleRow}>
                          <Text style={styles.levelNumber}>{level.level}</Text>
                          <View style={[styles.difficultyBadge, { backgroundColor: level.color }]}>
                            <Text style={styles.difficultyText}>{level.difficulty}</Text>
                          </View>
                        </View>
                        <Text style={styles.levelTitle}>{level.title}</Text>
                        <Text style={styles.levelSubtitle}>{level.subtitle}</Text>
                      </View>
                      
                      <View style={styles.expandIcon}>
                        <Text style={[styles.expandText, selectedLevel === level.id && styles.expandTextRotated]}>
                          ▼
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Expanded Content */}
                {selectedLevel === level.id && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.levelGoal}>{level.goal}</Text>
                    <Text style={styles.levelDescription}>{level.description}</Text>
                    
                    <View style={styles.levelDetails}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>⏱️</Text>
                        <Text style={styles.detailText}>Durată: {level.duration}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>📝</Text>
                        <Text style={styles.detailText}>{level.exercises} exerciții</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => handleStartChallenge(level)}
                    >
                      <LinearGradient
                        colors={level.gradientColors}
                        style={styles.startButtonGradient}
                      >
                        <Text style={styles.startButtonText}>Începe Provocarea</Text>
                        <Text style={styles.startButtonIcon}>🚀</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>💡 Sfaturi pentru succes</Text>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>• Începe întotdeauna cu nivelul 1</Text>
              <Text style={styles.tipItem}>• Fii răbdător cu tine însuți</Text>
              <Text style={styles.tipItem}>• Practică în mod consistent</Text>
              <Text style={styles.tipItem}>• Celebrează fiecare progres mic</Text>
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
    marginBottom: 25,
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
  historyWrap: { position: 'absolute', right: 0, top: 10 },
  historyButton: { borderRadius: 20, overflow: 'hidden' },
  historyButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  historyIcon: { color: '#fff', marginRight: 6 },
  historyButtonText: { color: '#fff', fontWeight: '700' },
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
  motivationSection: {
    marginBottom: 25,
  },
  motivationCard: {
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
  },
  motivationIcon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  motivationText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#2c3e50',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  motivationAuthor: {
    fontSize: 14,
    color: '#4a90e2',
    textAlign: 'center',
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 25,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  progressStats: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-around',
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
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6c7b84',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e8f4fd',
    marginHorizontal: 15,
  },
  levelsContainer: {
    marginBottom: 25,
  },
  levelCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  levelHeader: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  levelHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  levelHeaderGradient: {
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
    borderRadius: 16,
  },
  levelHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  levelIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  levelIcon: {
    fontSize: 26,
  },
  levelInfo: {
    flex: 1,
    paddingRight: 10,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a90e2',
    marginRight: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  levelTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  levelSubtitle: {
    fontSize: 14,
    color: '#6c7b84',
    fontWeight: '400',
  },
  expandIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
  },
  expandText: {
    fontSize: 12,
    color: '#4a90e2',
    fontWeight: 'bold',
    transform: [{ rotate: '0deg' }],
  },
  expandTextRotated: {
    transform: [{ rotate: '180deg' }],
  },
  expandedContent: {
    backgroundColor: '#f8fdff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8f4fd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  levelGoal: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '600',
  },
  levelDescription: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 15,
  },
  levelDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6c7b84',
    fontWeight: '500',
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  startButtonIcon: {
    fontSize: 16,
  },
  tipsSection: {
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
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  tipsList: {
    paddingLeft: 5,
  },
  tipItem: {
    fontSize: 14,
    color: '#6c7b84',
    lineHeight: 22,
    marginBottom: 6,
  },
});

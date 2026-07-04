import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { levels as levelDefs } from '../challenges';
import { useSubscription } from '../contexts/SubscriptionContext';
import { api } from '../utils/api';

const { width } = Dimensions.get('window');

export default function ProvocarilScreen({ navigation }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [cmsLevels, setCmsLevels] = useState([]);
  const { subscription } = useSubscription();
  const subType = subscription?.type || null;

  const isTrial = subType === 'trial';

  useEffect(() => {
    api.getCmsChallenges()
      .then((data) => setCmsLevels(data.levels || []))
      .catch(() => {});
  }, []);

  const challengeLevels = useMemo(() => {
    return levelDefs.map((l) => {
      const cmsMatch = cmsLevels.find((cl) => Number(cl.id) === Number(l.id));
      const hardcodedChallenges = l.challenges;
      const cmsChallenges = cmsMatch?.challenges?.map((c) => ({
        id: `cms-${c.id}`,
        title: c.title,
        est: c.est,
      })) || [];

      return {
        id: l.id,
        level: `Nivel ${l.id}`,
        title: l.title,
        subtitle: l.duration,
        goal: l.goal,
        description: l.goal,
        iconName: l.id === 1 ? 'leaf-outline' : l.id === 2 ? 'flash-outline' : 'flame-outline',
        iconColor: l.id === 1 ? '#3d7d5f' : l.id === 2 ? '#b3924f' : '#a8544c',
        color: l.color,
        gradientColors: l.gradientColors,
        difficulty: l.difficulty,
        duration: l.duration,
        exercises: hardcodedChallenges.length + cmsChallenges.length,
        challenges: [...hardcodedChallenges, ...cmsChallenges],
      };
    });
  }, [cmsLevels]);

  const handleLevelPress = (level) => {
    // Block Medium and Hard challenges during trial
    if (isTrial && level.id > 1) {
      Alert.alert(
        'Nivel restricționat',
        'Provocările de nivel Moderat și Avansat sunt disponibile doar cu un abonament activ.',
        [
          { text: 'Vezi abonamente', onPress: () => navigation.navigate('Subscriptions') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    setSelectedLevel(level.id === selectedLevel ? null : level.id);
  };

  const handleStartChallenge = (level) => {
    navigation.navigate('LevelChallenges', { level });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f6f7f8', '#f3f4f6', '#eef0f2']}
        style={styles.background}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
              style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="#24384e" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Ionicons name="trophy-outline" size={34} color="#24384e" />
              </View>
              <Text style={styles.title}>Provocări</Text>
              <Text style={styles.subtitle}>Alege-ți nivelul de provocare</Text>
            </View>

            <View style={styles.historyWrap}>
              <TouchableOpacity onPress={() => navigation.navigate('ChallengeHistory')} style={styles.historyButton}>
                <Ionicons name="time-outline" size={16} color="#24384e" style={{ marginRight: 5 }} />
                <Text style={styles.historyButtonText}>Istoric</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Challenge Levels */}
          <View style={styles.levelsContainer}>
            {challengeLevels.map((level) => {
              const locked = isTrial && level.id > 1;
              return (
              <View key={level.id} style={[styles.levelCard, locked && styles.lockedCard]}>
                <TouchableOpacity
                  style={[
                    styles.levelHeader,
                    selectedLevel === level.id && styles.levelHeaderExpanded
                  ]}
                  onPress={() => handleLevelPress(level)}
                >
                  <View style={styles.levelHeaderInner}>
                      <View style={[styles.levelIconContainer, { backgroundColor: locked ? 'rgba(32,47,62,0.14)' : level.iconColor + '18' }]}>
                        <Ionicons name={locked ? 'lock-closed-outline' : level.iconName} size={26} color={locked ? '#bbb' : level.iconColor} />
                      </View>
                      
                      <View style={styles.levelInfo}>
                        <View style={styles.levelTitleRow}>
                          <Text style={[styles.levelNumber, locked && styles.lockedText]}>{level.level}</Text>
                          <View style={[styles.difficultyBadge, { backgroundColor: locked ? '#bbb' : level.color }]}>
                            <Text style={styles.difficultyText}>{level.difficulty}</Text>
                          </View>
                        </View>
                        <Text style={[styles.levelTitle, locked && styles.lockedText]}>{level.title}</Text>
                        <Text style={[styles.levelSubtitle, locked && styles.lockedText]}>
                          {locked ? 'Disponibil cu abonament' : level.subtitle}
                        </Text>
                      </View>
                      
                      <Ionicons
                        name={selectedLevel === level.id ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={locked ? '#ccc' : '#24384e'}
                      />
                  </View>
                </TouchableOpacity>

                {/* Expanded Content */}
                {selectedLevel === level.id && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.levelGoal}>{level.goal}</Text>
                    
                    <View style={styles.levelDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={15} color="#5b6a7a" style={{ marginRight: 5 }} />
                        <Text style={styles.detailText}>Durată: {level.duration}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="list-outline" size={15} color="#5b6a7a" style={{ marginRight: 5 }} />
                        <Text style={styles.detailText}>{level.exercises} exerciții</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => handleStartChallenge(level)}
                    >
                      <View style={styles.startButtonInner}>
                        <Text style={styles.startButtonText}>Începe Provocarea</Text>
                        <Ionicons name="arrow-forward-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              );
            })}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <View style={styles.tipsTitleRow}>
              <Ionicons name="bulb-outline" size={18} color="#24384e" style={{ marginRight: 7 }} />
              <Text style={styles.tipsTitle}>Sfaturi pentru succes</Text>
            </View>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7f8',
  },
  background: {
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
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  historyWrap: { position: 'absolute', right: 0, top: 10 },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
  },
  historyButtonText: { color: '#24384e', fontWeight: '700', fontSize: 13 },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 28,
    fontWeight: '700',
    color: '#1c2b3a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#5b6a7a',
    textAlign: 'center',
    fontWeight: '400',
  },
  levelsContainer: {
    marginBottom: 25,
  },
  levelCard: {
    marginBottom: 14,
    borderRadius: 18,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lockedCard: {
    opacity: 0.55,
  },
  lockedText: {
    color: '#999',
  },
  levelHeader: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
  },
  levelHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  levelHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  levelIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  levelInfo: {
    flex: 1,
    paddingRight: 10,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  levelNumber: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: '#8a97a5',
    marginRight: 10,
    textTransform: 'uppercase',
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
    color: '#1c2b3a',
    marginBottom: 3,
  },
  levelSubtitle: {
    fontSize: 13,
    color: '#5b6a7a',
    fontWeight: '400',
  },
  expandedContent: {
    backgroundColor: 'rgba(246,247,248,0.95)',
    padding: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(32,47,62,0.18)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  levelGoal: {
    fontSize: 14,
    color: '#1c2b3a',
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: '500',
  },
  levelDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#5b6a7a',
    fontWeight: '500',
  },
  startButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  startButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#24384e',
    borderRadius: 14,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(32,47,62,0.18)',
    marginBottom: 20,
  },
  tipsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c2b3a',
  },
  tipsList: {
    paddingLeft: 5,
  },
  tipItem: {
    fontSize: 14,
    color: '#5b6a7a',
    lineHeight: 24,
  },
});

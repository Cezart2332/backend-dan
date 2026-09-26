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
import { Feather, Ionicons } from '@expo/vector-icons';
import { levels as levelDefs } from '../challenges';
import { useSubscription } from '../contexts/SubscriptionContext';
import { api } from '../utils/api';
import { useTheme, useThemedStyles } from './ui/themeContext';

const { width } = Dimensions.get('window');

export default function ProvocarilScreen({ navigation }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
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
        colors={[tc('#f6f7f8', 'bg'), tc('#f3f4f6', 'bg'), tc('#eef0f2', 'bg')]}
        style={styles.background}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
              style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="chevron-left" size={22} color={tc("#24384e", 'fg')} />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Feather name="award" size={34} color={tc("#24384e", 'fg')} />
              </View>
              <Text style={styles.title}>Provocări</Text>
              <Text style={styles.subtitle}>Alege-ți nivelul de provocare</Text>
            </View>

            <View style={styles.historyWrap}>
              <TouchableOpacity onPress={() => navigation.navigate('ChallengeHistory')} style={styles.historyButton}>
                <Feather name="clock" size={16} color={tc("#24384e", 'fg')} style={{ marginRight: 5 }} />
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
                      <View style={[styles.levelIconContainer, { backgroundColor: locked ? tc('rgba(32,47,62,0.14)', 'bg') : tc(level.iconColor, 'bg') + '18' }]}>
                        <Ionicons name={locked ? 'lock-closed-outline' : level.iconName} size={26} color={locked ? tc('#bbb', 'fg') : tc(level.iconColor, 'fg')} />
                      </View>
                      
                      <View style={styles.levelInfo}>
                        <View style={styles.levelTitleRow}>
                          <Text style={[styles.levelNumber, locked && styles.lockedText]}>{level.level}</Text>
                          <View style={[styles.difficultyBadge, { backgroundColor: locked ? tc('#bbb', 'bg') : level.color }]}>
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
                        color={locked ? tc('#ccc', 'fg') : tc('#24384e', 'fg')}
                      />
                  </View>
                </TouchableOpacity>

                {/* Expanded Content */}
                {selectedLevel === level.id && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.levelGoal}>{level.goal}</Text>
                    
                    <View style={styles.levelDetails}>
                      <View style={styles.detailItem}>
                        <Feather name="clock" size={15} color={tc("#5b6a7a", 'fg')} style={{ marginRight: 5 }} />
                        <Text style={styles.detailText}>Durată: {level.duration}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Feather name="list" size={15} color={tc("#5b6a7a", 'fg')} style={{ marginRight: 5 }} />
                        <Text style={styles.detailText}>{level.exercises} exerciții</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => handleStartChallenge(level)}
                    >
                      <View style={styles.startButtonInner}>
                        <Text style={styles.startButtonText}>Începe Provocarea</Text>
                        <Feather name="arrow-right" size={18} color={tc("#fff", 'fg')} style={{ marginLeft: 8 }} />
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
              <Feather name="zap" size={18} color={tc("#24384e", 'fg')} style={{ marginRight: 7 }} />
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

const createStyles = (tc) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tc('#f6f7f8', 'bg'),
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
  historyWrap: { position: 'absolute', right: 0, top: 10 },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
  },
  historyButtonText: { color: tc('#24384e', 'fg'), fontWeight: '700', fontSize: 13 },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: tc('rgba(255,255,255,0.55)', 'bg'),
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
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
    color: tc('#999', 'fg'),
  },
  levelHeader: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
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
    color: tc('#8a97a5', 'fg'),
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
    color: tc('#ffffff', 'fg'),
    fontWeight: '600',
  },
  levelTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tc('#1c2b3a', 'fg'),
    marginBottom: 3,
  },
  levelSubtitle: {
    fontSize: 13,
    color: tc('#5b6a7a', 'fg'),
    fontWeight: '400',
  },
  expandedContent: {
    backgroundColor: tc('rgba(246,247,248,0.95)', 'bg'),
    padding: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  levelGoal: {
    fontSize: 14,
    color: tc('#1c2b3a', 'fg'),
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
    color: tc('#5b6a7a', 'fg'),
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
    backgroundColor: tc('#24384e', 'bg'),
    borderRadius: 14,
  },
  startButtonText: {
    color: tc('#ffffff', 'fg'),
    fontSize: 16,
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: tc('rgba(255,255,255,0.58)', 'bg'),
    borderRadius: 18,
    padding: 20,
    shadowColor: '#24384e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: tc('rgba(32,47,62,0.18)', 'bg'),
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
    color: tc('#1c2b3a', 'fg'),
  },
  tipsList: {
    paddingLeft: 5,
  },
  tipItem: {
    fontSize: 14,
    color: tc('#5b6a7a', 'fg'),
    lineHeight: 24,
  },
});

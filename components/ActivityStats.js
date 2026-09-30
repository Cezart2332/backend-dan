import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './ui/theme';
import { useThemedStyles } from './ui/themeContext';

export default function ActivityStats({ stats, unavailable = 'Statisticile vor apărea după prima sincronizare.' }) {
  const styles = useThemedStyles(createStyles);
  if (!stats) return <Text style={styles.caption}>{unavailable}</Text>;
  return <View style={styles.grid}>
    {[[stats.audioCompleted, 'Audio-uri finalizate'], [stats.listeningMinutes, 'Minute parcurse'], [stats.challengesCompleted, 'Provocări trimise'], [stats.uniqueAudios, 'Lecții audio diferite']].map(([value,label]) => <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>)}
  </View>;
}
const createStyles = (tc) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: '44%', backgroundColor: tc(colors.primarySoft,'bg'), borderRadius: 18, padding: 17 },
  value: { fontSize: 30, fontFamily: fonts.display, color: tc(colors.text,'fg'), fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, lineHeight: 19, color: tc(colors.textMuted,'fg'), marginTop: 5 },
  caption: { fontSize: 13, lineHeight: 20, color: tc(colors.textMuted,'fg') },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, useThemedStyles } from './ui/themeContext';

// Simple reusable modal overlay for headphones recommendation
// Props:
//  visibleInitially (default true) - whether to show on mount
//  onDismiss - callback after dismiss
//  text - custom message (defaults to Romanian headphones recommendation)
const STORAGE_KEY = 'headphones_disclaimer_hidden';

export async function resetHeadphonesDisclaimer() {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function HeadphonesDisclaimer({ visibleInitially = true, onDismiss, text }) {
  const { tc } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [loadingPref, setLoadingPref] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted) {
          if (stored === '1') {
            setVisible(false);
          } else {
            setVisible(visibleInitially);
          }
        }
      } catch {
        if (mounted) setVisible(visibleInitially);
      } finally {
        if (mounted) setLoadingPref(false);
      }
    })();
    return () => { mounted = false; };
  }, [visibleInitially]);

  if (loadingPref || !visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.box} accessibilityRole="alert" accessibilityLabel="Recomandare">
        <Text style={styles.title}>Recomandare</Text>
        <Text style={styles.msg}>{text || 'Pentru cea mai bună experiență se recomandă folosirea căștilor!'}</Text>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setDontShow(!dontShow)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShow }}
        >
          <Ionicons name={dontShow ? 'checkbox-outline' : 'square-outline'} size={20} color={tc("#24384e", 'fg')} style={{ marginRight: 8 }} />
          <Text style={styles.rowText}>Nu mai afișa din nou</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={async () => {
            try {
              if (dontShow) await AsyncStorage.setItem(STORAGE_KEY, '1');
            } catch {}
            setVisible(false);
            onDismiss && onDismiss();
          }}
          accessibilityRole="button"
        >
          <LinearGradient colors={[tc("rgba(28,43,58,0.94)", 'bg'), tc("rgba(22,34,47,0.96)", 'bg')]} style={styles.btnGrad}>
            <Text style={styles.btnText}>Am înțeles</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (tc) => StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: tc('rgba(0,0,0,0.35)', 'bg'),
    justifyContent: 'center', alignItems: 'center', padding: 24,
    zIndex: 999,
  },
  box: {
    width: '100%', maxWidth: 420,
    backgroundColor: tc('rgba(246,247,248,0.97)', 'bg'), borderRadius: 26,
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18,
    shadowColor: '#24384e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20,
    elevation: 10,
    borderWidth: 1, borderColor: tc('rgba(32,47,62,0.22)', 'bg')
  },
  title: { fontSize: 18, fontWeight: '700', color: tc('#1c2b3a', 'fg'), marginBottom: 10, textAlign: 'center' },
  msg: { fontSize: 14, lineHeight: 20, color: tc('#5b6a7a', 'fg'), textAlign: 'center' },
  btn: { marginTop: 18, borderRadius: 16, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  btnText: { color: tc('#fff', 'fg'), fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 14, justifyContent: 'center' },
  rowText: { fontSize: 14, color: tc('#1c2b3a', 'fg') },
});

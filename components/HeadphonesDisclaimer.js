import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      <View style={styles.box} accessibilityRole="dialog" accessibilityLabel="Recomandare">
        <Text style={styles.title}>Recomandare</Text>
        <Text style={styles.msg}>{text || 'Pentru cea mai bună experiență se recomandă folosirea căștilor!'}</Text>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setDontShow(!dontShow)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShow }}
        >
          <Text style={styles.checkbox}>{dontShow ? '☑' : '☐'}</Text>
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
          <LinearGradient colors={["#4a90e2", "#357abd"]} style={styles.btnGrad}>
            <Text style={styles.btnText}>Am înțeles</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
    zIndex: 999,
  },
  box: {
    width: '100%', maxWidth: 420,
    backgroundColor: '#ffffff', borderRadius: 22,
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 10,
    borderWidth: 1, borderColor: '#e6f3ff'
  },
  title: { fontSize: 18, fontWeight: '700', color: '#2c3e50', marginBottom: 10, textAlign: 'center' },
  msg: { fontSize: 14, lineHeight: 20, color: '#2c3e50', textAlign: 'center' },
  btn: { marginTop: 18, borderRadius: 16, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 14, justifyContent: 'center' },
  checkbox: { fontSize: 18, marginRight: 8 },
  rowText: { fontSize: 14, color: '#2c3e50' },
});

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';
import HeadphonesDisclaimer from './HeadphonesDisclaimer';

const fromConstants = Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL || Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL = fromConstants || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export default function AjutorAnxietateVideoScreen({ navigation }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const source = { uri: `${BASE_URL}/api/media/Incurajare.mp4` };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#f0f8ff", "#e6f3ff", "#ffffff"]} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ajutor - anxietate</Text>
          <Text style={styles.subtitle}>Intervenție ghidată</Text>
        </View>

        <View style={styles.playerWrap}>
          <Video
            ref={videoRef}
            style={styles.video}
            source={source}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={setStatus}
            shouldPlay={false}
            isLooping={false}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            if (!status.isPlaying) videoRef.current?.playAsync();
            else videoRef.current?.pauseAsync();
          }}
        >
          <LinearGradient colors={["#4a90e2", "#357abd"]} style={styles.btnInner}>
            <Text style={styles.primaryText}>{status.isPlaying ? 'Pauză' : 'Redă video'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, padding: 20 },
  header: { alignItems: 'center', marginBottom: 16 },
  backBtn: {
    position: 'absolute', left: 0, top: -2,
    backgroundColor: '#fff', borderRadius: 20, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e8f4fd', elevation: 3,
  },
  backIcon: { fontSize: 18, color: '#4a90e2', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: '#2c3e50', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c7b84', textAlign: 'center', marginTop: 6 },
  playerWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 },
  video: { width: width - 40, height: (width - 40) * 9 / 16, backgroundColor: '#000' },
  primaryBtn: { borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});

import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';
import HeadphonesDisclaimer, { resetHeadphonesDisclaimer } from './HeadphonesDisclaimer';

const fromConstants = Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL || Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL = fromConstants || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export default function AboutDanIntroScreen({ navigation }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const source = { uri: `${BASE_URL}/api/media/${encodeURIComponent('about_dan_intro.mp4')}` };

  const handlePlaybackStatusUpdate = useCallback((newStatus) => {
    setStatus(newStatus);
    if (newStatus.isLoaded) {
      setIsLoading(false);
      setError(null);
    }
    if (newStatus.error) {
      setError(newStatus.error);
      setIsLoading(false);
    }
  }, []);

  const handleError = useCallback((err) => {
    console.log("Video error:", err);
    setError("Nu s-a putut încărca videoclipul");
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#f0f8ff", "#e6f3ff", "#ffffff"]} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Intro</Text>
          <Text style={styles.subtitle}>Clip video introdus de Dan</Text>
        </View>

        <View style={styles.playerWrap}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4a90e2" />
              <Text style={styles.loadingText}>Se încarcă...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setError(null);
                  setIsLoading(true);
                  videoRef.current?.loadAsync(source, {}, false);
                }}
              >
                <Text style={styles.retryText}>Reîncearcă</Text>
              </TouchableOpacity>
            </View>
          )}
          <Video
            ref={videoRef}
            style={styles.video}
            source={source}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={handleError}
            onLoad={handleLoad}
            shouldPlay={false}
            isLooping={false}
            usePoster={Platform.OS === "android"}
            posterStyle={styles.video}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (isLoading || error) && styles.btnDisabled]}
          disabled={isLoading || !!error}
          onPress={() => {
            if (!status.isPlaying) videoRef.current?.playAsync();
            else videoRef.current?.pauseAsync();
          }}
        >
          <LinearGradient colors={["#4a90e2", "#357abd"]} style={styles.btnInner}>
            <Text style={styles.primaryText}>{status.isPlaying ? 'Pauză' : 'Redă Intro'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <HeadphonesDisclaimer />
        <TouchableOpacity
          style={styles.debugBtn}
          onPress={async () => {
            await resetHeadphonesDisclaimer();
            setStatus(s => ({ ...s, _debugReset: Date.now() }));
          }}
        >
          <Text style={styles.debugText}>Reset căști (debug)</Text>
        </TouchableOpacity>
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
  playerWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16, position: 'relative' },
  video: { width: width - 40, height: (width - 40) * 9 / 16, backgroundColor: '#000' },
  loadingOverlay: {
    position: 'absolute', zIndex: 10, alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { color: '#4a90e2', marginTop: 8, fontSize: 14 },
  errorOverlay: {
    position: 'absolute', zIndex: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', width: width - 40, height: (width - 40) * 9 / 16, borderRadius: 8,
  },
  errorText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#4a90e2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  primaryBtn: { borderRadius: 12, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  debugBtn: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8f4fd' },
  debugText: { fontSize: 12, color: '#4a90e2', fontWeight: '600' },
});

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  AppState,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const { width } = Dimensions.get("window");

const fromConstants =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL =
  fromConstants || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Configure the global audio session once at module level.
 * staysActiveInBackground = true  →  audio continues when phone is locked
 *                                     or app is in the background.
 * NOTE: Background audio requires a **development build** or **production build**.
 *       It does NOT work inside Expo Go.
 */
async function ensureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn("Audio.setAudioModeAsync failed:", e);
  }
}

// Call once at import time so the session is ready before any component mounts
ensureAudioSession();

/**
 * Reusable Video Player Screen component with audio-only background mode.
 * When "audio-only" is active the video view is hidden, playback uses expo-av
 * Audio.Sound which continues in the background (phone locked / app minimised).
 */
export default function VideoPlayerScreen({
  navigation,
  title = "Video",
  subtitle = "",
  videoFile,
  playButtonText = "Redă video",
}) {
  // ─── shared state ───
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioOnly, setAudioOnly] = useState(false);

  // Always keep the direct MP4 URL for audio (HLS doesn't work with Audio.Sound)
  const directMp4Uri = `${BASE_URL}/api/media/${encodeURIComponent(videoFile)}`;
  const videoId = videoFile.replace(/\.[^.]+$/, "");
  const [sourceUri, setSourceUri] = useState(directMp4Uri);

  // ─── VIDEO player (expo-video) ───
  const player = useVideoPlayer(sourceUri, (p) => {
    p.loop = false;
  });

  const { isPlaying: videoIsPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const { status: videoStatus } = useEvent(player, "statusChange", {
    status: player.status,
  });

  // ─── AUDIO player (expo-av) ───
  const soundRef = useRef(null);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioIsLoaded, setAudioIsLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);

  // Derived helpers
  const isPlaying = audioOnly ? audioIsPlaying : videoIsPlaying;

  // ── Re-activate audio session when app returns to foreground ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && audioOnly) {
        // Re-assert audio session — iOS sometimes deactivates it
        ensureAudioSession();
      }
    });
    return () => sub.remove();
  }, [audioOnly]);

  // ── Resolve best source URL (HLS → fallback) — only for VIDEO mode ──
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    async function pickSource() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${BASE_URL}/api/videos/${encodeURIComponent(videoId)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const maybeUrl = data?.hlsUrl;
          if (maybeUrl) {
            const absolute = maybeUrl.startsWith("http")
              ? maybeUrl
              : `${BASE_URL}${maybeUrl}`;
            if (isMounted) setSourceUri(absolute);
            return;
          }
        }
      } catch {
        // ignore – use fallback
      }
      if (isMounted) setSourceUri(directMp4Uri);
    }
    pickSource();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [videoId, directMp4Uri]);

  // ── Video status → loading/error tracking ──
  useEffect(() => {
    if (audioOnly) return;
    if (videoStatus === "readyToPlay") {
      setIsLoading(false);
      setError(null);
    } else if (videoStatus === "error") {
      setIsLoading(false);
      setError("Nu s-a putut încărca videoclipul");
    } else if (videoStatus === "loading") {
      setIsLoading(true);
    }
  }, [videoStatus, audioOnly]);

  // ── Audio status callback ──
  const onAudioStatus = useCallback((status) => {
    if (!status.isLoaded) {
      setAudioIsPlaying(false);
      return;
    }
    setAudioIsPlaying(status.isPlaying);
    setAudioDuration(status.durationMillis || 0);
    setAudioPosition(status.positionMillis || 0);
  }, []);

  // ── Load / unload Audio.Sound when audioOnly toggles ──
  useEffect(() => {
    if (!audioOnly) {
      // Unload sound when switching back to video
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setAudioIsPlaying(false);
        setAudioIsLoaded(false);
      }
      return;
    }

    // Pause the video player when entering audio-only mode
    try {
      player.pause();
    } catch {}

    let cancelled = false;

    async function loadSound() {
      setIsLoading(true);
      setError(null);

      // Ensure audio session is configured before creating the sound
      await ensureAudioSession();

      try {
        // Always use the direct MP4 URL — HLS doesn't work with Audio.Sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: directMp4Uri },
          {
            shouldPlay: true, // auto-play when entering audio mode
            progressUpdateIntervalMillis: 500,
            androidImplementation: "MediaPlayer",
          },
          onAudioStatus
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setAudioIsLoaded(true);
        setIsLoading(false);
      } catch (e) {
        console.warn("Audio.Sound.createAsync failed:", e);
        if (!cancelled) {
          setError("Nu s-a putut încărca audio-ul");
          setIsLoading(false);
        }
      }
    }

    loadSound();

    return () => {
      cancelled = true;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [audioOnly, directMp4Uri, onAudioStatus]);

  // ── Clean up sound on unmount ──
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // ── Play / Pause ──
  const handlePlayPause = useCallback(async () => {
    if (audioOnly) {
      if (!soundRef.current) return;
      try {
        if (audioIsPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          await ensureAudioSession();
          await soundRef.current.playAsync();
        }
      } catch (e) {
        console.warn("Audio play/pause error:", e);
      }
    } else {
      if (videoIsPlaying) {
        player.pause();
      } else {
        player.play();
      }
    }
  }, [audioOnly, audioIsPlaying, videoIsPlaying, player]);

  // ── Retry ──
  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    if (audioOnly) {
      // Re-toggle to reload
      setAudioOnly(false);
      setTimeout(() => setAudioOnly(true), 100);
    } else {
      player.replace(sourceUri);
    }
  }, [audioOnly, player, sourceUri]);

  // ── Toggle audio-only ──
  const toggleAudioOnly = useCallback(async () => {
    if (audioOnly) {
      // Switch back to video
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
      }
      setAudioOnly(false);
    } else {
      setAudioOnly(true);
    }
  }, [audioOnly]);

  // ── Format time helper ──
  function formatTime(ms) {
    if (!ms || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              // Stop audio before going back so it doesn't keep playing
              if (soundRef.current) {
                soundRef.current.stopAsync().catch(() => {});
              }
              navigation.goBack();
            }}
            style={styles.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={22} color="#4a90e2" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {/* ─── VIDEO VIEW (hidden in audio-only mode) ─── */}
        {!audioOnly && (
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
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                  <Text style={styles.retryText}>Reîncearcă</Text>
                </TouchableOpacity>
              </View>
            )}
            <VideoView
              style={styles.video}
              player={player}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="contain"
            />
          </View>
        )}

        {/* ─── AUDIO-ONLY VIEW ─── */}
        {audioOnly && (
          <View style={styles.audioWrap}>
            {isLoading && (
              <View style={styles.audioLoadingWrap}>
                <ActivityIndicator size="large" color="#4a90e2" />
                <Text style={styles.loadingText}>Se încarcă audio...</Text>
              </View>
            )}
            {error && (
              <View style={styles.audioErrorWrap}>
                <Text style={styles.errorTextDark}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                  <Text style={styles.retryText}>Reîncearcă</Text>
                </TouchableOpacity>
              </View>
            )}
            {!isLoading && !error && (
              <>
                <View style={styles.audioIconWrap}>
                  <Ionicons
                    name={audioIsPlaying ? "musical-notes-outline" : "headset-outline"}
                    size={36}
                    color="#4a90e2"
                  />
                </View>
                <Text style={styles.audioLabel}>Mod audio – ecranul poate fi blocat</Text>
                <Text style={styles.audioTime}>
                  {formatTime(audioPosition)} / {formatTime(audioDuration)}
                </Text>
                {/* Simple progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width:
                          audioDuration > 0
                            ? `${(audioPosition / audioDuration) * 100}%`
                            : "0%",
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {/* ─── PLAY / PAUSE ─── */}
        <TouchableOpacity
          style={[styles.primaryBtn, (isLoading || error) && styles.btnDisabled]}
          disabled={isLoading || !!error}
          onPress={handlePlayPause}
        >
          <LinearGradient
            colors={["#4a90e2", "#357abd"]}
            style={styles.btnInner}
          >
            <Text style={styles.primaryText}>
              {isPlaying ? "Pauză" : playButtonText}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ─── AUDIO-ONLY TOGGLE ─── */}
        <TouchableOpacity
          style={styles.audioToggleBtn}
          onPress={toggleAudioOnly}
        >
          <LinearGradient
            colors={audioOnly ? ["#4a90e2", "#357abd"] : ["rgba(255,255,255,0.9)", "rgba(240,248,255,0.9)"]}
            style={styles.audioToggleInner}
          >
            <Ionicons
              name={audioOnly ? "musical-notes-outline" : "headset-outline"}
              size={18}
              color={audioOnly ? "#fff" : "#4a90e2"}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.audioToggleText,
                audioOnly && styles.audioToggleTextActive,
              ]}
            >
              {audioOnly ? "Revino la video" : "Doar audio (fundal)"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ddeeff" },
  gradient: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(74,144,226,0.15)",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1a2d45",
  },
  subtitle: {
    fontSize: 14,
    color: "#6c8096",
    marginTop: 6,
  },
  /* ── video ── */
  playerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
    position: "relative",
  },
  video: {
    width: width - 40,
    height: ((width - 40) * 9) / 16,
    backgroundColor: "#000",
    borderRadius: 8,
  },
  loadingOverlay: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#4a90e2",
    marginTop: 8,
    fontSize: 14,
  },
  errorOverlay: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    width: width - 40,
    height: ((width - 40) * 9) / 16,
    borderRadius: 8,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  errorTextDark: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  /* ── audio-only ── */
  audioWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 18,
    padding: 24,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(200,220,240,0.6)",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 180,
  },
  audioLoadingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  audioErrorWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  audioIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eaf4ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  audioIcon: { fontSize: 32 },
  audioLabel: {
    fontSize: 14,
    color: "#6c8096",
    textAlign: "center",
    marginBottom: 8,
  },
  audioTime: {
    fontSize: 13,
    color: "#1a2d45",
    fontWeight: "600",
    marginBottom: 8,
  },
  progressBarBg: {
    width: "100%",
    height: 4,
    backgroundColor: "#e8f4fd",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#4a90e2",
    borderRadius: 2,
  },
  /* ── buttons ── */
  primaryBtn: { borderRadius: 12, overflow: "hidden" },
  btnDisabled: { opacity: 0.6 },
  btnInner: { paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  audioToggleBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e8f4fd",
  },
  audioToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  audioToggleIcon: { fontSize: 18, marginRight: 8 },
  audioToggleText: { fontSize: 14, fontWeight: "600", color: "#1a2d45" },
  audioToggleTextActive: { color: "#fff" },
});

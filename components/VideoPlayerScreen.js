import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Constants from "expo-constants";
import Slider from "@react-native-community/slider";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";
import { PressableScale } from "./ui";

const fromConstants =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL =
  fromConstants || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

const SERIF = Platform.OS === "ios" ? "Georgia" : "serif";

// Culorile modului cinema (navy închis, derivat din cerneala logo-ului)
const INK = {
  bg: "#10161d",
  bgSoft: "#16222f",
  text: "#f6f7f8",
  textMuted: "rgba(246,247,248,0.62)",
  textSoft: "rgba(246,247,248,0.4)",
  surface: "rgba(255,255,255,0.07)",
  surfaceStrong: "rgba(255,255,255,0.12)",
  border: "rgba(246,247,248,0.14)",
  accent: "#b3924f",
};

/**
 * Reusable Video Player Screen component with audio-only background mode and
 * lock-screen / notification controls powered by expo-video.
 */
export default function VideoPlayerScreen({
  navigation,
  title = "Video",
  subtitle = "",
  videoFile,
  playButtonText = "Redă video",
  nowPlayingTitle,
  nowPlayingArtist,
  nowPlayingArtwork,
  nowPlayingAccent,
}) {
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Keep direct MP4 for audio-only mode so seeking stays predictable.
  const directMp4Uri = `${BASE_URL}/api/media/${encodeURIComponent(videoFile)}`;
  const videoId = videoFile.replace(/\.[^.]+$/, "");
  const [videoSourceUri, setVideoSourceUri] = useState(directMp4Uri);

  const resolvedNowPlayingArtwork = useMemo(() => {
    const rawArtwork = nowPlayingArtwork?.trim?.() || "";
    if (rawArtwork) {
      if (/^https?:\/\//i.test(rawArtwork)) return rawArtwork;
      if (rawArtwork.startsWith("/")) return `${BASE_URL}${rawArtwork}`;
      return `${BASE_URL}/api/media/${rawArtwork.replace(/^\/+/, "")}`;
    }

    const params = new URLSearchParams();
    params.set("title", nowPlayingTitle?.trim?.() || title?.trim?.() || "Dan fost anxios");
    params.set("artist", nowPlayingArtist?.trim?.() || subtitle?.trim?.() || "Dan fost anxios");
    if (nowPlayingAccent) {
      params.set("accent", nowPlayingAccent);
    }

    return `${BASE_URL}/api/videos/${encodeURIComponent(videoId)}/artwork?${params.toString()}`;
  }, [
    nowPlayingArtwork,
    nowPlayingTitle,
    nowPlayingArtist,
    nowPlayingAccent,
    title,
    subtitle,
    videoId,
  ]);

  const nowPlayingMetadata = useMemo(
    () => ({
      title: nowPlayingTitle?.trim?.() || title?.trim?.() || "Dan fost anxios",
      artist: nowPlayingArtist?.trim?.() || subtitle?.trim?.() || "Dan fost anxios",
      artwork: resolvedNowPlayingArtwork,
    }),
    [nowPlayingTitle, title, nowPlayingArtist, subtitle, resolvedNowPlayingArtwork]
  );

  const activeSource = useMemo(
    () => ({
      uri: audioOnly ? directMp4Uri : videoSourceUri,
      metadata: nowPlayingMetadata,
    }),
    [audioOnly, directMp4Uri, videoSourceUri, nowPlayingMetadata]
  );

  const player = useVideoPlayer(activeSource, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.audioMixingMode = "auto";
  });

  const { isPlaying: videoIsPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const { status: videoStatus } = useEvent(player, "statusChange", {
    status: player.status,
  });

  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const { duration: sourceDuration } = useEvent(player, "sourceLoad", {
    videoSource: null,
    duration: 0,
    availableVideoTracks: [],
    availableSubtitleTracks: [],
    availableAudioTracks: [],
  });

  const durationSeconds = sourceDuration || player.duration || 0;
  const positionSeconds = Math.min(
    Math.max(currentTime || player.currentTime || 0, 0),
    durationSeconds > 0 ? durationSeconds : Number.MAX_SAFE_INTEGER
  );
  const displayedPositionSeconds = isSeeking ? seekValue : positionSeconds;
  const sliderMaximum = durationSeconds > 0 ? durationSeconds : 1;
  const sliderValue = Math.min(
    Math.max(displayedPositionSeconds, 0),
    sliderMaximum
  );
  const availableVideoWidth = Math.max(width - 40, 240);
  const maxVideoHeight = Math.max(180, Math.floor(height * 0.34));
  const videoWidth = Math.min(
    availableVideoWidth,
    Math.floor(maxVideoHeight * (16 / 9))
  );
  const videoHeight = Math.floor(videoWidth * (9 / 16));

  // Keep media playback active in background for both video and audio-only modes.
  useEffect(() => {
    player.staysActiveInBackground = true;
    player.showNowPlayingNotification = true;
    player.keepScreenOnWhilePlaying = !audioOnly;
    player.audioMixingMode = audioOnly ? "doNotMix" : "auto";
  }, [audioOnly, player]);

  useEffect(() => {
    if (audioOnly) {
      player.play();
    }
  }, [audioOnly, player, activeSource]);

  // Resolve best source URL (HLS -> fallback) for video mode.
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
            if (isMounted) setVideoSourceUri(absolute);
            return;
          }
        }
      } catch {
        // Ignore and use direct MP4 fallback.
      }

      if (isMounted) setVideoSourceUri(directMp4Uri);
    }

    pickSource();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [videoId, directMp4Uri]);

  useEffect(() => {
    if (videoStatus === "readyToPlay") {
      setIsLoading(false);
      setError(null);
    } else if (videoStatus === "error") {
      setIsLoading(false);
      setError(
        audioOnly
          ? "Nu s-a putut încărca audio-ul"
          : "Nu s-a putut încărca videoclipul"
      );
    } else if (videoStatus === "loading" || videoStatus === "idle") {
      setIsLoading(true);
    }
  }, [videoStatus, audioOnly]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
        player.staysActiveInBackground = false;
        player.showNowPlayingNotification = false;
      } catch { }
    };
  }, [player]);

  const handlePlayPause = useCallback(() => {
    if (videoIsPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [videoIsPlaying, player]);

  const seekTo = useCallback(
    (nextSeconds) => {
      const maxDuration = player.duration || durationSeconds;
      let target = Math.max(nextSeconds, 0);
      if (maxDuration > 0) {
        target = Math.min(target, maxDuration);
      }
      player.currentTime = target;
      setSeekValue(target);
    },
    [durationSeconds, player]
  );

  const handleSeekBy = useCallback(
    (deltaSeconds) => {
      seekTo((player.currentTime || 0) + deltaSeconds);
    },
    [player, seekTo]
  );

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(player.currentTime || 0);
  }, [player]);

  const handleSeekChange = useCallback(
    (nextValue) => {
      if (isSeeking) {
        setSeekValue(nextValue);
      }
    },
    [isSeeking]
  );

  const handleSeekComplete = useCallback(
    (nextValue) => {
      seekTo(nextValue);
      setIsSeeking(false);
    },
    [seekTo]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    player.replace(activeSource);
    player.play();
  }, [activeSource, player]);

  const toggleAudioOnly = useCallback(() => {
    setAudioOnly((prev) => !prev);
  }, []);

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const handleSpeedChange = useCallback(
    (rate) => {
      setPlaybackRate(rate);
      player.playbackRate = rate;
    },
    [player]
  );

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "0:00";
    const totalSec = Math.floor(seconds);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  }

  const controlsDisabled = isLoading || !!error;

  return (
    <SafeAreaView style={styles.safeArea}>
      {isFocused ? <StatusBar style="light" /> : null}
      <LinearGradient colors={[INK.bg, INK.bgSoft]} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <PressableScale
              onPress={() => {
                player.pause();
                player.staysActiveInBackground = false;
                player.showNowPlayingNotification = false;
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate("Dashboard");
              }}
              style={styles.backBtn}
              scaleTo={0.9}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="chevron-left" size={22} color={INK.text} />
            </PressableScale>
            <View style={styles.headerTextWrap}>
              {subtitle ? (
                <Text style={styles.overline}>{subtitle.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
            </View>
          </View>

          {/* ── Scena ── */}
          {!audioOnly ? (
            <View style={styles.playerWrap}>
              {isLoading && (
                <View
                  style={[
                    styles.stateOverlay,
                    { width: videoWidth, height: videoHeight },
                  ]}
                >
                  <ActivityIndicator size="large" color={INK.text} />
                  <Text style={styles.stateText}>Se încarcă...</Text>
                </View>
              )}
              {error && (
                <View
                  style={[
                    styles.stateOverlay,
                    styles.errorOverlay,
                    { width: videoWidth, height: videoHeight },
                  ]}
                >
                  <Feather name="alert-triangle" size={22} color={INK.text} />
                  <Text style={styles.stateText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                    <Text style={styles.retryText}>Reîncearcă</Text>
                  </TouchableOpacity>
                </View>
              )}
              <VideoView
                style={[styles.video, { width: videoWidth, height: videoHeight }]}
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={styles.audioStage}>
              {isLoading && (
                <View style={styles.audioCenter}>
                  <ActivityIndicator size="large" color={INK.text} />
                  <Text style={styles.stateText}>Se încarcă audio...</Text>
                </View>
              )}
              {error && (
                <View style={styles.audioCenter}>
                  <Feather name="alert-triangle" size={22} color={INK.text} />
                  <Text style={styles.stateText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                    <Text style={styles.retryText}>Reîncearcă</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!isLoading && !error && (
                <View style={styles.audioCenter}>
                  <View style={styles.audioHalo}>
                    <View style={styles.audioRing}>
                      <Feather
                        name={videoIsPlaying ? "music" : "headphones"}
                        size={30}
                        color={INK.text}
                      />
                    </View>
                  </View>
                  <Text style={styles.audioHint}>
                    Mod audio — ecranul poate fi blocat
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Progres (mod audio) ── */}
          {audioOnly && !isLoading && !error ? (
            <View style={styles.progressWrap}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={sliderMaximum}
                value={sliderValue}
                onSlidingStart={handleSeekStart}
                onValueChange={handleSeekChange}
                onSlidingComplete={handleSeekComplete}
                minimumTrackTintColor={INK.accent}
                maximumTrackTintColor="rgba(246,247,248,0.18)"
                thumbTintColor={INK.text}
                disabled={controlsDisabled || durationSeconds <= 0}
              />
              <View style={styles.timesRow}>
                <Text style={styles.timeText}>{formatTime(displayedPositionSeconds)}</Text>
                <Text style={styles.timeText}>{formatTime(durationSeconds)}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Transport ── */}
          <View style={styles.transportRow}>
            <PressableScale
              onPress={() => handleSeekBy(-15)}
              disabled={controlsDisabled}
              style={[styles.skipBtn, controlsDisabled && styles.disabled]}
              scaleTo={0.9}
            >
              <Feather name="rotate-ccw" size={19} color={INK.text} />
              <Text style={styles.skipLabel}>15</Text>
            </PressableScale>

            <PressableScale
              onPress={handlePlayPause}
              disabled={controlsDisabled}
              style={[styles.playBtn, controlsDisabled && styles.disabled]}
              scaleTo={0.93}
            >
              <Feather
                name={videoIsPlaying ? "pause" : "play"}
                size={28}
                color="#10161d"
                style={videoIsPlaying ? null : { marginLeft: 3 }}
              />
            </PressableScale>

            <PressableScale
              onPress={() => handleSeekBy(15)}
              disabled={controlsDisabled}
              style={[styles.skipBtn, controlsDisabled && styles.disabled]}
              scaleTo={0.9}
            >
              <Feather name="rotate-cw" size={19} color={INK.text} />
              <Text style={styles.skipLabel}>15</Text>
            </PressableScale>
          </View>

          <Text style={styles.playHint}>
            {videoIsPlaying ? "Redare..." : audioOnly ? "Redă audio" : playButtonText}
          </Text>

          {/* ── Viteză ── */}
          <View style={styles.speedRow}>
            {SPEEDS.map((rate) => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.speedBtn,
                  playbackRate === rate && styles.speedBtnActive,
                ]}
                onPress={() => handleSpeedChange(rate)}
                disabled={controlsDisabled}
              >
                <Text
                  style={[
                    styles.speedText,
                    playbackRate === rate && styles.speedTextActive,
                  ]}
                >
                  {rate}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Mod audio ── */}
          <PressableScale
            onPress={toggleAudioOnly}
            style={[styles.audioToggle, audioOnly && styles.audioToggleActive]}
            scaleTo={0.97}
          >
            <Feather
              name={audioOnly ? "film" : "headphones"}
              size={16}
              color={audioOnly ? "#10161d" : INK.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.audioToggleText, audioOnly && styles.audioToggleTextActive]}>
              {audioOnly ? "Revino la video" : "Doar audio (fundal)"}
            </Text>
          </PressableScale>
        </ScrollView>
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: INK.bg },
  gradient: { flex: 1 },
  scrollContainer: {
    padding: 20,
    flexGrow: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: INK.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.border,
    marginRight: 14,
    zIndex: 10,
  },
  headerTextWrap: { flex: 1 },
  overline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.2,
    color: INK.textSoft,
    marginBottom: 4,
  },
  title: {
    fontFamily: SERIF,
    letterSpacing: 0.2,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: INK.text,
  },

  playerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 22,
    position: "relative",
  },
  video: {
    alignSelf: "center",
    backgroundColor: "#000",
    borderRadius: 18,
    overflow: "hidden",
  },
  stateOverlay: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorOverlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 18,
  },
  stateText: {
    color: INK.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: INK.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.border,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: { color: INK.text, fontWeight: "600", fontSize: 13 },

  audioStage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 210,
    marginTop: 6,
    marginBottom: 10,
  },
  audioCenter: { alignItems: "center", gap: 10 },
  audioHalo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(246,247,248,0.1)",
  },
  audioRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK.surface,
    borderWidth: 1,
    borderColor: INK.border,
  },
  audioHint: {
    fontSize: 12.5,
    color: INK.textSoft,
    marginTop: 4,
  },

  progressWrap: { marginBottom: 6 },
  slider: { width: "100%", height: 36 },
  timesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  timeText: {
    fontSize: 11.5,
    color: INK.textMuted,
    fontVariant: ["tabular-nums"],
  },

  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    marginTop: 10,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f6f7f8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  skipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.border,
  },
  skipLabel: {
    position: "absolute",
    fontSize: 8.5,
    fontWeight: "700",
    color: INK.text,
    top: 21,
  },
  playHint: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: INK.textSoft,
    fontWeight: "600",
  },
  disabled: { opacity: 0.4 },

  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    gap: 6,
    flexWrap: "wrap",
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.border,
    backgroundColor: "transparent",
  },
  speedBtnActive: {
    backgroundColor: "#f6f7f8",
    borderColor: "#f6f7f8",
  },
  speedText: {
    fontSize: 12,
    fontWeight: "600",
    color: INK.textMuted,
  },
  speedTextActive: { color: "#10161d", fontWeight: "700" },

  audioToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK.border,
    backgroundColor: INK.surface,
  },
  audioToggleActive: {
    backgroundColor: "#f6f7f8",
    borderColor: "#f6f7f8",
  },
  audioToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: INK.text,
  },
  audioToggleTextActive: { color: "#10161d" },
});

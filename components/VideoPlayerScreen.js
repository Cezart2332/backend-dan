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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Constants from "expo-constants";
import Slider from "@react-native-community/slider";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const fromConstants =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL =
  fromConstants || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#f6f7f8", "#f3f4f6", "#eef0f2"]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                player.pause();
                player.staysActiveInBackground = false;
                player.showNowPlayingNotification = false;
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate("Dashboard");
              }}
              style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.75}
            >
              <Feather name="chevron-left" size={22} color="#24384e" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>

          {!audioOnly && (
            <View style={styles.playerWrap}>
              {isLoading && (
                <View
                  style={[
                    styles.loadingOverlay,
                    { width: videoWidth, height: videoHeight },
                  ]}
                >
                  <ActivityIndicator size="large" color="#24384e" />
                  <Text style={styles.loadingText}>Se încarcă...</Text>
                </View>
              )}
              {error && (
                <View
                  style={[
                    styles.errorOverlay,
                    { width: videoWidth, height: videoHeight },
                  ]}
                >
                  <Text style={styles.errorText}>{error}</Text>
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
          )}

          {audioOnly && (
            <View style={styles.audioWrap}>
              {isLoading && (
                <View style={styles.audioLoadingWrap}>
                  <ActivityIndicator size="large" color="#24384e" />
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
                      name={videoIsPlaying ? "musical-notes-outline" : "headset-outline"}
                      size={36}
                      color="#24384e"
                    />
                  </View>
                  <Text style={styles.audioLabel}>Mod audio - ecranul poate fi blocat</Text>
                  <Text style={styles.audioTime}>
                    {formatTime(displayedPositionSeconds)} / {formatTime(durationSeconds)}
                  </Text>

                  <Slider
                    style={styles.audioSlider}
                    minimumValue={0}
                    maximumValue={sliderMaximum}
                    value={sliderValue}
                    onSlidingStart={handleSeekStart}
                    onValueChange={handleSeekChange}
                    onSlidingComplete={handleSeekComplete}
                    minimumTrackTintColor="#24384e"
                    maximumTrackTintColor="#e3e7eb"
                    thumbTintColor="#24384e"
                    disabled={isLoading || !!error || durationSeconds <= 0}
                  />
                  <View style={styles.audioTimesRow}>
                    <Text style={styles.audioTimeSmall}>{formatTime(displayedPositionSeconds)}</Text>
                    <Text style={styles.audioTimeSmall}>{formatTime(durationSeconds)}</Text>
                  </View>

                  <View style={styles.skipControlsRow}>
                    <TouchableOpacity
                      style={[styles.skipBtn, (isLoading || !!error) && styles.btnDisabled]}
                      onPress={() => handleSeekBy(-15)}
                      disabled={isLoading || !!error}
                    >
                      <Ionicons
                        name="play-back"
                        size={16}
                        color="#24384e"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.skipBtnText}>-15s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.skipBtn, (isLoading || !!error) && styles.btnDisabled]}
                      onPress={() => handleSeekBy(15)}
                      disabled={isLoading || !!error}
                    >
                      <Ionicons
                        name="play-forward"
                        size={16}
                        color="#24384e"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.skipBtnText}>+15s</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (isLoading || error) && styles.btnDisabled]}
            disabled={isLoading || !!error}
            onPress={handlePlayPause}
          >
            <LinearGradient
              colors={["rgba(28,43,58,0.94)", "rgba(22,34,47,0.96)"]}
              style={styles.btnInner}
            >
              <Text style={styles.primaryText}>
                {videoIsPlaying ? "Pauză" : audioOnly ? "Redă audio" : playButtonText}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.speedRow}>
            <Text style={styles.speedLabel}>Viteză:</Text>
            {SPEEDS.map((rate) => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.speedBtn,
                  playbackRate === rate && styles.speedBtnActive,
                ]}
                onPress={() => handleSpeedChange(rate)}
                disabled={isLoading || !!error}
              >
                <Text
                  style={[
                    styles.speedBtnText,
                    playbackRate === rate && styles.speedBtnTextActive,
                  ]}
                >
                  {rate}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.audioToggleBtn}
            onPress={toggleAudioOnly}
          >
            <LinearGradient
              colors={audioOnly ? ["#24384e", "#16222f"] : ["rgba(255,255,255,0.68)", "rgba(246,247,248,0.9)"]}
              style={styles.audioToggleInner}
            >
              <Ionicons
                name={audioOnly ? "musical-notes-outline" : "headset-outline"}
                size={18}
                color={audioOnly ? "#fff" : "#24384e"}
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
        </ScrollView>
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6f7f8" },
  gradient: { flex: 1 },
  scrollContainer: {
    padding: 20,
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12, // Reduced margin
    marginTop: 4,
  },
  headerTextWrap: {
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.18)",
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 14,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.2,
    fontSize: 20,
    fontWeight: "700",
    color: "#1c2b3a",
  },
  subtitle: {
    fontSize: 14,
    color: "#5b6a7a",
    marginTop: 2, // Reduced margin
  },
  playerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
    position: "relative",
  },
  video: {
    alignSelf: "center",
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
    color: "#24384e",
    marginTop: 8,
    fontSize: 14,
  },
  errorOverlay: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
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
    backgroundColor: "#24384e",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  audioWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.58)",
    borderRadius: 18,
    padding: 24,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.18)",
    shadowColor: "#24384e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 220,
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
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  audioLabel: {
    fontSize: 14,
    color: "#5b6a7a",
    textAlign: "center",
    marginBottom: 8,
  },
  audioTime: {
    fontSize: 13,
    color: "#1c2b3a",
    fontWeight: "600",
    marginBottom: 4,
  },
  audioSlider: {
    width: "100%",
    height: 36,
  },
  audioTimesRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
    marginBottom: 10,
  },
  audioTimeSmall: {
    fontSize: 12,
    color: "#5b6a7a",
  },
  skipControlsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  skipBtn: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e3e7eb",
    backgroundColor: "#f5f6f8",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16222f",
  },
  primaryBtn: { borderRadius: 12, overflow: "hidden" },
  btnDisabled: { opacity: 0.6 },
  btnInner: { paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  audioToggleBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.18)",
  },
  audioToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  audioToggleText: { fontSize: 14, fontWeight: "600", color: "#1c2b3a" },
  audioToggleTextActive: { color: "#fff" },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 4,
    gap: 6,
    flexWrap: "wrap",
  },
  speedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5b6a7a",
    marginRight: 4,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e3e7eb",
    backgroundColor: "#f5f6f8",
  },
  speedBtnActive: {
    borderColor: "#24384e",
    backgroundColor: "#24384e",
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16222f",
  },
  speedBtnTextActive: {
    color: "#fff",
  },
});

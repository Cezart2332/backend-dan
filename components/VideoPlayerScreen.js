import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Constants from "expo-constants";
import HeadphonesDisclaimer from "./HeadphonesDisclaimer";

const { width } = Dimensions.get("window");

const fromConstants =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const BASE_URL =
  fromConstants || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Reusable Video Player Screen component
 * @param {object} props
 * @param {object} props.navigation - React Navigation object
 * @param {string} props.title - Screen title
 * @param {string} props.subtitle - Screen subtitle
 * @param {string} props.videoFile - Video filename to load from API
 * @param {string} props.playButtonText - Text for play button (default: "Redă video")
 */
export default function VideoPlayerScreen({
  navigation,
  title = "Video",
  subtitle = "",
  videoFile,
  playButtonText = "Redă video",
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const videoUri = `${BASE_URL}/api/media/${encodeURIComponent(videoFile)}`;

  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  useEffect(() => {
    if (status === "readyToPlay") {
      setIsLoading(false);
      setError(null);
    } else if (status === "error") {
      setIsLoading(false);
      setError("Nu s-a putut încărca videoclipul");
    } else if (status === "loading") {
      setIsLoading(true);
    }
  }, [status]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    player.replace(videoUri);
  }, [player, videoUri]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#f0f8ff", "#e6f3ff", "#ffffff"]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
        <HeadphonesDisclaimer />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, padding: 20 },
  header: { alignItems: "center", marginBottom: 16 },
  backBtn: {
    position: "absolute",
    left: 0,
    top: -2,
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8f4fd",
    elevation: 3,
  },
  backIcon: { fontSize: 18, color: "#4a90e2", fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6c7b84",
    textAlign: "center",
    marginTop: 6,
  },
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
  retryBtn: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  primaryBtn: { borderRadius: 12, overflow: "hidden" },
  btnDisabled: { opacity: 0.6 },
  btnInner: { paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
});

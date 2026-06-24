import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AjutorAnxietateVideoScreen({ route, navigation }) {
  const {
    title,
    videoFile,
    nowPlayingTitle,
    nowPlayingArtist,
    nowPlayingArtwork,
    nowPlayingAccent,
  } = route.params || {};

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title || "Ajutor - anxietate"}
      subtitle="Intervenție ghidată"
      videoFile={videoFile || "ajutor_anxietate_ce_sa_ma_fac_cu_starile.mp4"}
      playButtonText="Redă video"
      nowPlayingTitle={nowPlayingTitle || title || "Ajutor - anxietate"}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Ajutor anxietate"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#2f73d8"}
    />
  );
}

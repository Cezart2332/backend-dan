import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AjutorAtacPanicaVideoScreen({ route, navigation }) {
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
      title={title || "Ajutor - atac de panică"}
      subtitle="Intervenție ghidată"
      videoFile={videoFile || "ajutor_atac_de_panica_esti_in_siguranta.mp4"}
      playButtonText="Redă video"
      nowPlayingTitle={nowPlayingTitle || title || "Ajutor - atac de panică"}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Ajutor atac de panică"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#3f9f64"}
    />
  );
}

import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function DinExperientaMeaVideoScreen({ route, navigation }) {
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
      title={title || "Din experiența mea"}
      subtitle="Poveste personală"
      videoFile={videoFile || "din_experienta_mea_incurajare.mp4"}
      playButtonText="Redă video"
      nowPlayingTitle={nowPlayingTitle || title || "Din experiența mea"}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Experiențe reale"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#2bbbad"}
    />
  );
}

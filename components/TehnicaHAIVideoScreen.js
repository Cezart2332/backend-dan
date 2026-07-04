import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function TehnicaHAIVideoScreen({ route, navigation }) {
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
      title={title || "Tehnica HAI"}
      subtitle="Aplicare practică"
      videoFile={videoFile || "pasul_1_tehnica_HAI.mp4"}
      playButtonText="Redă audio"
      nowPlayingTitle={nowPlayingTitle || title || "Tehnica HAI"}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Tehnica HAI"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#3e7e76"}
    />
  );
}

import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AudioAnxietateVideoScreen({ route, navigation }) {
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
      title={title || "Audio despre anxietate"}
      subtitle="Înțelege anxietatea"
      videoFile={videoFile || "intelege_anxietatea_ganduri_si_emotii.mp4"}
      playButtonText="Redă audio"
      nowPlayingTitle={nowPlayingTitle || title || "Audio despre anxietate"}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Audio anxietate"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#5c5a80"}
    />
  );
}

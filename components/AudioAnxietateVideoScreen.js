import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AudioAnxietateVideoScreen({ route, navigation }) {
  const { title, videoFile } = route.params || {};

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title || "Audio despre anxietate"}
      subtitle="Înțelege anxietatea"
      videoFile={videoFile || "intelege_anxietatea_ganduri_si_emotii.mp4"}
      playButtonText="Redă audio"
    />
  );
}

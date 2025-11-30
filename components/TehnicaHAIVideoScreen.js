import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function TehnicaHAIVideoScreen({ route, navigation }) {
  const { title, videoFile } = route.params || {};

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title || "Tehnica HAI"}
      subtitle="Aplicare practică"
      videoFile={videoFile || "pasul_1_tehnica_HAI.mp4"}
      playButtonText="Redă audio"
    />
  );
}

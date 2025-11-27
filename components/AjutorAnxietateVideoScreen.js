import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AjutorAnxietateVideoScreen({ navigation }) {
  return (
    <VideoPlayerScreen
      navigation={navigation}
      title="Ajutor - anxietate"
      subtitle="Intervenție ghidată"
      videoFile="Incurajare.mp4"
      playButtonText="Redă video"
    />
  );
}

import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AjutorRauVideoScreen({ navigation }) {
  return (
    <VideoPlayerScreen
      navigation={navigation}
      title="Ajutor în caz că îți este rău"
      subtitle="Intervenție ghidată"
      videoFile="senzatia de capcana.mp4"
      playButtonText="Redă video"
    />
  );
}

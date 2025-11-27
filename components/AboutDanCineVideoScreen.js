import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AboutDanCineVideoScreen({ navigation }) {
  return (
    <VideoPlayerScreen
      navigation={navigation}
      title="Cine sunt eu?"
      subtitle="Video de prezentare"
      videoFile="about_dan_cine.mp4"
      playButtonText="Redă video"
    />
  );
}

import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function IntelegeAnxietateVideoScreen({ navigation, route }) {
  const title = route.params?.title || "Resursă video";
  const videoFile = route.params?.videoFile || "Intro.mp4";

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title}
      subtitle="Vizionare introductivă înainte de a asculta audio-urile"
      videoFile={videoFile}
      playButtonText="Redă video"
    />
  );
}

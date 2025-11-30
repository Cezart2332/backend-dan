import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function DinExperientaMeaVideoScreen({ route, navigation }) {
  const { title, videoFile } = route.params || {};

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title || "Din experiența mea"}
      subtitle="Poveste personală"
      videoFile={videoFile || "din_experienta_mea_incurajare.mp4"}
      playButtonText="Redă video"
    />
  );
}

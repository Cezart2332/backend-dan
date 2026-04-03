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
      nowPlayingTitle="Cine sunt eu?"
      nowPlayingArtist="Dan fost anxios · Povestea lui Dan"
      nowPlayingAccent="#9b59b6"
    />
  );
}

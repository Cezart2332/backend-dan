import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function AboutDanIntroScreen({ navigation }) {
  return (
    <VideoPlayerScreen
      navigation={navigation}
      title="Intro"
      subtitle="Despre Dan"
      videoFile="about_dan_intro.mp4"
      playButtonText="Redă Intro"
      nowPlayingTitle="Intro · Despre Dan"
      nowPlayingArtist="Dan fost anxios · Despre Dan"
    />
  );
}

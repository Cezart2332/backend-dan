import React from "react";
import VideoPlayerScreen from "./VideoPlayerScreen";

export default function IntelegeAnxietateVideoScreen({ navigation, route }) {
  const title = route.params?.title || "Resursă video";
  const videoFile = route.params?.videoFile || "Intro.mp4";
  const nowPlayingTitle = route.params?.nowPlayingTitle;
  const nowPlayingArtist = route.params?.nowPlayingArtist;
  const nowPlayingArtwork = route.params?.nowPlayingArtwork;
  const nowPlayingAccent = route.params?.nowPlayingAccent;

  return (
    <VideoPlayerScreen
      navigation={navigation}
      title={title}
      subtitle="Vizionare introductivă înainte de a asculta audio-urile"
      videoFile={videoFile}
      playButtonText="Redă video"
      nowPlayingTitle={nowPlayingTitle || title}
      nowPlayingArtist={nowPlayingArtist || "Dan fost anxios · Lecție video"}
      nowPlayingArtwork={nowPlayingArtwork}
      nowPlayingAccent={nowPlayingAccent || "#24384e"}
    />
  );
}

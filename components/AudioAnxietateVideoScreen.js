import React from 'react';
import VideoPlayerScreen from './VideoPlayerScreen';
import AudioAccessGate from './AudioAccessGate';

export default function AudioAnxietateVideoScreen({ route, navigation }) {
  const { title, videoFile, nowPlayingTitle, nowPlayingArtist, nowPlayingArtwork, nowPlayingAccent } = route.params || {};
  return <AudioAccessGate navigation={navigation}>
    <VideoPlayerScreen navigation={navigation} title={title || 'Înțelege anxietatea'}
      subtitle="Înțelege anxietatea" videoFile={videoFile || 'intelege_anxietatea_ganduri_si_emotii.mp4'}
      nowPlayingTitle={nowPlayingTitle || title} nowPlayingArtist={nowPlayingArtist || 'Dan fost anxios · Înțelege anxietatea'}
      nowPlayingArtwork={nowPlayingArtwork} nowPlayingAccent={nowPlayingAccent} />
  </AudioAccessGate>;
}

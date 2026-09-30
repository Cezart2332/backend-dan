import React from 'react';
import VideoLibraryContent from './VideoLibraryContent';

export default function AudioLibraryContent({ navigation, lessons, cmsSubsections, hasPaidSub }) {
  return <VideoLibraryContent navigation={navigation} title="Înțelege anxietatea"
    description="Explicații și lecții despre anxietate. Alege un videoclip și parcurge-l în ritmul tău."
    lessons={lessons} sections={cmsSubsections} hasPaidSub={hasPaidSub}
    onPlay={(item, group) => navigation.navigate('AudioAnxietateVideo', {
      title: item.title, videoFile: item.videoFile || `${item.storage_key}.mp4`,
      nowPlayingArtist: `Dan fost anxios · ${group?.title || 'Înțelege anxietatea'}`,
    })} />;
}

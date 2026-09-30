import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const videos = [
  {
    id: "ameteala",
    title: "Amețeala",
    videoFile: "tehnica_hai_in_starile_fizice_ameteala.mp4",
    iconName: "eye-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "echilibrul",
    title: "Echilibrul",
    videoFile: "tehnica_hai_in_starile_fizice_echilibrul.mp4",
    iconName: "resize-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
  {
    id: "rezultate_normale",
    title: "Rezultate normale",
    videoFile: "tehnica_hai_in_starile_fizice_rezultate_normale.mp4",
    iconName: "checkmark-circle-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
];

export default function TehnicaHAIFiziceScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('tehnica-hai-fizice').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="HAI · Stări fizice" description="Videoclipuri despre aplicarea tehnicii HAI în senzațiile corporale."
    lessons={videos} sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => navigation.navigate('TehnicaHAIVideo', {
      title:item.title, videoFile:item.videoFile || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || "HAI · Stări fizice"}`,
      nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

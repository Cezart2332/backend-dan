import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const videos = [
  {
    id: "incurajare",
    title: "Încurajare",
    videoFile: "din_experienta_mea_incurajare.mp4",
    iconName: "barbell-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "frica_cumparaturi",
    title: "Frica de cumpărături",
    videoFile: "din_experienta_mea_frica_cumparaturi.mp4",
    iconName: "cart-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "frica_performanta",
    title: "Frica de performanță",
    videoFile: "din_experienta_mea_frica_performanta.mp4",
    iconName: "trophy-outline",
    iconColor: "#6d6b8f",
    iconBg: "#ececf2",
  },
  {
    id: "frica_volan",
    title: "Frica de volan",
    videoFile: "din_experienta_mea_frica_volan.mp4",
    iconName: "car-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
  {
    id: "senzatia_capcana",
    title: "Senzația de capcană",
    videoFile: "din_experienta_mea_senzatia_de_capcana.mp4",
    iconName: "lock-closed-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "furnicaturi",
    title: "Furnicături",
    videoFile: "din_experienta_mea_furnicaturi.mp4",
    iconName: "flash-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "slabiciune_picioare",
    title: "Slăbiciune în picioare",
    videoFile: "din_experienta_mea_slabiciune_in_picioare.mp4",
    iconName: "walk-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
];

export default function DinExperientaMeaScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('din-experienta-mea').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="Din experiența mea" description="Povești și lecții personale împărtășite de Dan."
    lessons={videos} sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => navigation.navigate('DinExperientaMeaVideo', {
      title:item.title, videoFile:item.videoFile || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || "Din experiența mea"}`,
      nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const videos = [
  {
    id: "ganduri_anxioase",
    title: "Gânduri anxioase",
    videoFile: "tehnica_hai_in_starile_psiholgice_ganduri_anxioase.mp4",
    iconName: "chatbubble-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "ganduri_tulburatoare",
    title: "Gânduri tulburătoare",
    videoFile: "tehnica_hai_in_stari_psihologice_ganduri_tulburato.mp4",
    iconName: "sync-circle-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "depresie_anxietate",
    title: "Depresie în anxietate",
    videoFile: "tehnica_hai_in_stari_psihologice_depresie_in_anxie.mp4",
    iconName: "cloudy-outline",
    iconColor: "#5a7a95",
    iconBg: "#edf4fb",
  },
  {
    id: "senzatia_irealitate",
    title: "Senzația de irealitate",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatia_irealitate.mp4",
    iconName: "contrast-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
  {
    id: "pierdere_control",
    title: "Senzație de pierdere a controlului",
    videoFile: "tehnica_hai_in_stari_psihologice_senzatie_de_pierdere_a_controlului.mp4",
    iconName: "infinite-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "teama_innebuni",
    title: "Teama că vei înnebuni",
    videoFile: "tehnica_hai_in_starile_psihologice_teama_ca_vei_innebunii.mp4",
    iconName: "help-circle-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
  },
];

export default function TehnicaHAIPsihologiceScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('tehnica-hai-psihologice').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="HAI · Stări psihologice" description="Videoclipuri despre aplicarea tehnicii HAI în gânduri și stări dificile."
    lessons={videos} sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => navigation.navigate('TehnicaHAIVideo', {
      title:item.title, videoFile:item.videoFile || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || "HAI · Stări psihologice"}`,
      nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

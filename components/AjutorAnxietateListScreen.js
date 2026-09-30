import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const videos = [
  {
    id: "ce_sa_fac",
    title: "Ce să mă fac cu stările?",
    videoFile: "ajutor_anxietate_ce_sa_ma_fac_cu_starile.mp4",
    iconName: "chatbubble-ellipses-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "confrunta_frica",
    title: "Confruntă frica",
    videoFile: "ajutor_am_anxietate_acum_confrunta_frica.mp4",
    iconName: "barbell-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "recadere",
    title: "Am o recădere",
    videoFile: "ajutor_anxietate_am_o_recadere.mp4",
    iconName: "refresh-circle-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
];

export default function AjutorAnxietateListScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('ajutor-anxietate').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="Am anxietate acum" description="Alege un videoclip de sprijin pentru momentul prin care treci."
    lessons={videos} sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => navigation.navigate('AjutorAnxietateVideo', {
      title:item.title, videoFile:item.videoFile || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || "Am anxietate acum"}`,
      nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

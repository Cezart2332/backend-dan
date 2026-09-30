import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const videos = [
  {
    id: "esti_in_siguranta",
    title: "Ești în siguranță",
    videoFile: "ajutor_atac_de_panica_esti_in_siguranta.mp4",
    iconName: "shield-checkmark-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
  {
    id: "provoaca_atacul",
    title: "Provoacă atacul de panică",
    videoFile: "ajutor_atac_de_panica_provoaca_atacul_de_panica.mp4",
    iconName: "barbell-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "sigur_nu_voi_pati",
    title: "Sigur nu voi păți ceva rău",
    videoFile: "ajutor_atac_panica_sigur_nu_voi_pati_ceva_rau.mp4",
    iconName: "checkmark-circle-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
  {
    id: "trebuie_sa_accept",
    title: "Trebuie să accept anxietatea",
    videoFile: "ajutor_atac_panica_trebuie_sa_accept_anxietatea.mp4",
    iconName: "leaf-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
  {
    id: "sos_mai_poti",
    title: "SOS - Mai poți 1 minut",
    videoFile: "ajutor_sos_am_atac_de_panica_mai_poti_1_min.mp4",
    iconName: "alert-circle-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
  },
];

export default function AjutorAtacPanicaListScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('ajutor-atac-panica').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="Atac de panică" description="Materiale de sprijin pentru momentele dificile, în ritmul tău."
    lessons={videos} sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => navigation.navigate('AjutorAtacPanicaVideo', {
      title:item.title, videoFile:item.videoFile || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || "Atac de panică"}`,
      nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

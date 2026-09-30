import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import AudioLibraryContent from './AudioLibraryContent';
import AudioAccessGate from './AudioAccessGate';

const videos = [
  {
    id: "intro",
    title: "Introducere în anxietate",
    videoFile: "intelege_anxietatea_intro.mp4",
    iconName: "hand-left-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "ganduri_si_emotii",
    title: "Gânduri și emoții",
    videoFile: "intelege_anxietatea_ganduri_si_emotii.mp4",
    iconName: "chatbubble-ellipses-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "aspecte_esentiale",
    title: "Aspecte esențiale",
    videoFile: "intelege_anxietatea_aspecte_esentiale.mp4",
    iconName: "star-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "diferenta",
    title: "Diferența între anxietatea normală și cea patologică",
    videoFile: "intelege_anxietatea_diferenta_intre_anxietatea_normala_si_cea_patologica.mp4",
    iconName: "resize-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
  },
  {
    id: "elimina_patologica",
    title: "Elimină anxietatea patologică",
    videoFile: "intelege_anxietatea_elimina_anxietatea_patologica.mp4",
    iconName: "construct-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
  },
  {
    id: "greseli_comune",
    title: "Greșeli comune",
    videoFile: "intelege_anxietatea_greseli_comune.mp4",
    iconName: "warning-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
  },
  {
    id: "greseli_acceptare_1",
    title: "Greșeli în acceptarea anxietății (1)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii.mp4",
    iconName: "document-text-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "greseli_acceptare_2",
    title: "Greșeli în acceptarea anxietății (2)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part2.mp4",
    iconName: "document-text-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "greseli_acceptare_3",
    title: "Greșeli în acceptarea anxietății (3)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part3.mp4",
    iconName: "document-text-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "greseli_acceptare_4",
    title: "Greșeli în acceptarea anxietății (4)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part4.mp4",
    iconName: "document-text-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "greseli_acceptare_5",
    title: "Greșeli în acceptarea anxietății (5)",
    videoFile: "intelege_anxietatea_greseli_in_acceptarea_anxietatii_part5.mp4",
    iconName: "document-text-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
  },
  {
    id: "insomnia",
    title: "Insomnia",
    videoFile: "intelege_anxietatea_insomnia.mp4",
    iconName: "moon-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
  },
  {
    id: "legatura_supravietuire",
    title: "Legătura între anxietate și răspunsul de supraviețuire",
    videoFile: "intelege_anxietatea_legatura_intre_anxietate_si_raspunsul_de_supravietuire.mp4",
    iconName: "link-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
  },
  {
    id: "nu_poti_face_avc",
    title: "Nu poți face AVC",
    videoFile: "intelege_anxietatea_nu_poti_face_AVC.mp4",
    iconName: "pulse-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
  },
];

export default function AudioAnxietateListScreen({ navigation }) {
 const [cmsSubsections,setCmsSubsections]=useState([]);
 const { subscription,hasProEntitlement }=useSubscription();
 const hasPaidSub=hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
 useEffect(()=>{let active=true;api.getCmsVideoSection('audio-anxietate').then(data=>{if(active)setCmsSubsections(data.subsections || []);}).catch(()=>{});return()=>{active=false;};},[]);
 return <AudioAccessGate navigation={navigation}><AudioLibraryContent navigation={navigation} lessons={videos} cmsSubsections={cmsSubsections} hasPaidSub={hasPaidSub} /></AudioAccessGate>;
}

import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

const steps = [
  {
    id: "pas1",
    title: "Pasul 1 din tehnica HAI",
    description: "Identifică semnalele anxietății și setează intenția corectă încă din primele secunde.",
    iconName: "disc-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
    badge: "1",
    video: "pasul_1_tehnica_HAI.mp4",
  },
  {
    id: "pas2",
    title: "Pasul 2 din tehnica HAI",
    description: "Folosește respirația conștientă pentru a-ți calma corpul și a recăpăta ritmul interior.",
    iconName: "disc-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
    badge: "2",
    video: "pasul_2_tehnica_HAI.mp4",
  },
  {
    id: "pas3",
    title: "Pasul 3 din tehnica HAI",
    description: "Transformă dialogul intern și reorientează gândurile anxioase către perspective constructive.",
    iconName: "disc-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
    badge: "3",
    video: "pasul_3_tehnica_HAI.mp4",
  },
  {
    id: "pas4",
    title: "Pasul 4 din tehnica HAI",
    description: "Integrează acțiuni concrete care consolidează starea de calm pe termen lung.",
    iconName: "disc-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    badge: "4",
    video: "pasul_4_tehnica_HAI.mp4",
  },
  {
    id: "rezumat",
    title: "Rezumatul tehnicii HAI",
    description: "Recapitulează rapid fiecare pas și păstrează un ghid mental la îndemână.",
    iconName: "document-text-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
    video: "rezumat_hai.mp4",
  },
  {
    id: "beneficii",
    title: "Beneficiile tehnicii HAI",
    description: "Descoperă ce rezultate concrete poți obține aplicând constant tehnica.",
    iconName: "star-outline",
    iconColor: "#b3924f",
    iconBg: "#f7f2e7",
    video: "beneficii_hai.mp4",
  },
  {
    id: "practica",
    title: "Practicarea tehnicii HAI",
    description: "Construiește o rutină zilnică astfel încât HAI să devină un reflex sănătos.",
    iconName: "repeat-outline",
    iconColor: "#24384e",
    iconBg: "#e8ebef",
    video: "practicarea_tehnica_hai.mp4",
  },
  {
    id: "practica_pas1",
    title: "Practicarea pasului 1",
    description: "Exerciții detaliate pentru a stăpâni primul pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#3d7d5f",
    iconBg: "#e9f0ec",
    video: "tehnica_hai_practicarea_pasului_1.mp4",
  },
  {
    id: "practica_pas2",
    title: "Practicarea pasului 2",
    description: "Exerciții detaliate pentru a stăpâni al doilea pas al tehnicii HAI.",
    iconName: "locate-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    video: "tehnica_hai_practicarea_pasului_2.mp4",
  },
  {
    id: "context",
    title: "Tehnica HAI în contexte reale",
    description: "Aplică metoda în situații reale: la job, acasă, în trafic sau în relații.",
    iconName: "earth-outline",
    iconColor: "#3e7e76",
    iconBg: "#e9f0ef",
    video: "tehnica_hai_in_contexte_reale.mp4",
  },
];

const audioPackages = [
  {
    id: "audio-psihologice",
    title: "Aplicarea tehnicii HAI în stările psihologice",
    note: "Ghidaje audio pentru gânduri intruzive, teamă de anticipare și anxietate socială.",
    iconName: "bulb-outline",
    iconColor: "#5c5a80",
    iconBg: "#ececf2",
    screen: "TehnicaHAIPsihologice",
  },
  {
    id: "audio-fizice",
    title: "Aplicarea tehnicii HAI în stările fizice",
    note: "Exerciții audio dedicate palpitațiilor, tensiunii musculare și senzațiilor corporale intense.",
    iconName: "heart-outline",
    iconColor: "#a8544c",
    iconBg: "#f6ecea",
    screen: "TehnicaHAIFizice",
  },
];

export default function TehniciScreen({ navigation }) {
  const [sections,setSections] = useState([]);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    api.getCmsVideoSection('tehnica-hai').then(data => { if(active) setSections(data.subsections || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <VideoLibraryContent navigation={navigation} title="Tehnica HAI"
    description="Descoperă pașii metodei și aplicarea lor în situațiile de zi cu zi."
    lessons={[...steps,...audioPackages.map(item => ({...item,kind:'category',description:item.note}))]}
    sections={sections} hasPaidSub={paid}
    onPlay={(item,group) => item.screen ? navigation.navigate(item.screen) : navigation.navigate('TehnicaHAIVideo',{
      title:item.title, videoFile:item.video || `${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group?.title || 'Tehnica HAI'}`, nowPlayingAccent:group?.icon_color || item.iconColor,
    })} />;
}

import React from 'react';
import VideoLibraryContent from './VideoLibraryContent';

const items = [
  {id:'intro',title:'Intro',description:'Prezentarea lui Dan',screen:'AboutDanIntro'},
  {id:'cine',title:'Cine sunt eu?',description:'Povestea lui Dan',screen:'AboutDanCineVideo'},
  {id:'experienta',title:'Din experiența mea',kind:'category',screen:'DinExperientaMea'},
];
export default function AboutDanScreen({ navigation }) {
  return <VideoLibraryContent navigation={navigation} title="Despre Dan"
    description="Cunoaște povestea lui Dan și experiențele pe care le împărtășește."
    lessons={items} sectionLabel="Povestea și experiența lui Dan"
    onPlay={item => navigation.navigate(item.screen)} />;
}

import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import VideoLibraryContent from './VideoLibraryContent';

export default function CmsSectionScreen({ route, navigation }) {
  const { slug,title } = route.params || {};
  const [data,setData] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState(false), [retry,setRetry] = useState(0);
  const { subscription,hasProEntitlement } = useSubscription();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setData(null);
    if (!slug) { setLoading(false); setError(true); return () => { active = false; }; }
    api.getCmsVideoSection(slug).then(result => { if(active) setData(result); }).catch(() => { if(active) setError(true); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [slug,retry]);
  return <VideoLibraryContent navigation={navigation} title={title || data?.section?.title || 'Videoclipuri'}
    description={data?.section?.description} sections={data?.subsections || []} hasPaidSub={paid} restricted={!paid}
    loading={paid && loading} error={paid && error} onRetry={() => setRetry(value => value + 1)}
    onPlay={(item,group) => navigation.navigate('IntelegeAnxietateVideo',{
      title:item.title, sectionTitle:title || data?.section?.title || group.title, videoFile:`${item.storage_key}.mp4`, nowPlayingTitle:item.title,
      nowPlayingArtist:`Dan fost anxios · ${group.title}`, nowPlayingAccent:group.icon_color || '#24384e',
    })} />;
}

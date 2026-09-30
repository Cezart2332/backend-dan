import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from './ui/theme';
import { useTheme } from './ui/themeContext';

// A film frame, not a fabricated screenshot or audio waveform.
export default function VideoArtwork({ size = 100, icon = 'play' }) {
  const { tc } = useTheme();
  const ink = tc(colors.primary, 'fg'), accent = tc(colors.accent, 'fg');
  return <Svg width={size} height={size * 0.75} viewBox="0 0 120 90" accessible={false} aria-hidden={true} focusable={false}>
    <Rect x="7" y="10" width="106" height="70" rx="16" fill={tc(colors.primarySoft, 'bg')} />
    <Rect x="15" y="18" width="90" height="54" rx="10" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.3" />
    <Line x1="23" y1="28" x2="34" y2="28" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    <Line x1="86" y1="62" x2="97" y2="62" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    {icon === 'folder' ? <Path d="M44 36h13l5 5h17v18H43V36Z" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" /> : <>
      <Circle cx="60" cy="45" r="17" fill={tc(colors.surfaceStrong, 'bg')} />
      <Path d="m56 37 12 8-12 8Z" fill={ink} />
    </>}
  </Svg>;
}

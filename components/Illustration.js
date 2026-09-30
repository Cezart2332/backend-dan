import React from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from './ui/theme';
import { useTheme } from './ui/themeContext';

// Original vector artwork: one visual language, each drawing tied to an action.
export default function Illustration({ kind = 'audio', size = 120 }) {
  const { tc } = useTheme();
  const ink = tc(colors.primary, 'fg'), gold = tc(colors.accent, 'fg'), paper = tc(colors.primarySoft, 'bg');
  return <Svg width={size} height={size} viewBox="0 0 160 160" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })} pointerEvents="none">
    <Ellipse cx="80" cy="139" rx="51" ry="6" fill={ink} opacity="0.06" />
    {kind === 'audio' ? <>
      <Rect x="19" y="22" width="122" height="110" rx="38" fill={paper} />
      <G fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M39 88V71c0-25 18-43 41-43s41 18 41 43v17" />
        <Path d="M47 61c5-16 17-25 33-25s29 10 33 25" strokeWidth="2" />
        <Rect x="33" y="77" width="21" height="37" rx="9" fill={paper} />
        <Rect x="106" y="77" width="21" height="37" rx="9" fill={paper} />
        <Path d="M116 115c-4 13-14 20-29 20" strokeWidth="2" />
      </G>
      <G stroke={gold} strokeWidth="3" strokeLinecap="round"><Line x1="65" y1="83" x2="65" y2="101" /><Line x1="75" y1="73" x2="75" y2="111" /><Line x1="85" y1="79" x2="85" y2="105" /><Line x1="95" y1="85" x2="95" y2="99" /></G>
      <Circle cx="84" cy="135" r="4" fill={gold} />
    </> : kind === 'journey' ? <>
      <Path d="M26 127c-6-16 3-26 26-29s46-2 49-21-43-16-37-37c3-10 14-14 30-14" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <Path d="M39 127c-2-8 3-14 15-15s37-1 47-13" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 7" />
      <Circle cx="26" cy="127" r="6" fill={paper} stroke={ink} strokeWidth="2" />
      <Circle cx="95" cy="26" r="6" fill={gold} />
      <Path d="M112 84V42m0 0c12 0 17 12 28 9v19c-12 3-15-9-28-9" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M55 132v-15m0 9c-12 1-14-8-12-12 7-1 12 5 12 12m0-7c1-9 7-12 12-10 0 7-6 10-12 10" fill="none" stroke={gold} strokeWidth="2" />
    </> : kind === 'friends' ? <>
      <Circle cx="55" cy="52" r="18" fill={paper} stroke={ink} strokeWidth="2" /><Circle cx="108" cy="62" r="16" fill={paper} stroke={ink} strokeWidth="2" />
      <Path d="M23 116c0-27 13-41 32-41s31 14 31 41M91 117h44c0-21-10-36-27-36-7 0-13 3-18 8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <Path d="M59 102c-13-15-21 1-11 10l11 10 11-10c10-9 2-25-11-10Z" fill={paper} stroke={gold} strokeWidth="2" />
      <Path d="M114 25h22v16h-7l-5 6v-6h-10Z" fill={paper} stroke={gold} strokeWidth="2" strokeLinejoin="round" />
    </> : <>
      <Circle cx="80" cy="78" r="48" fill={paper} />
      <Path d="M54 77l18 18 35-36" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M31 69c3-22 19-40 41-44M127 87c-4 21-19 37-39 41" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="76" cy="24" r="3" fill={gold} /><Circle cx="84" cy="129" r="3" fill={gold} />
    </>}
  </Svg>;
}

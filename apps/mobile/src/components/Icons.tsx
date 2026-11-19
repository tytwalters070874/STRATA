import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

interface IconProps {
  size?: number;
  color?: string;
}

// Line icons drawn like a field notebook: one stroke weight, round ends.
// Decorative: the button around each icon carries the accessible label.

/** Hand lens with a question mark: "how STRATA works". */
export function HelpIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16 L21 21" />
      <Path d="M9 9.5 C 9 8, 13 8, 13 10 C 13 11.5, 11 11.5, 11 13" />
      <Circle cx={11} cy={15} r={0.4} />
    </Svg>
  );
}

/** Stacked layers: the geologic map overlay. */
export function LayersIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round">
      <Path d="M3 8 L12 4 L21 8 L12 12 Z" />
      <Path d="M3 12.5 L12 16.5 L21 12.5" />
      <Path d="M3 17 L12 21 L21 17" />
    </Svg>
  );
}

/** Crosshair: back to my location. */
export function LocateIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Circle cx={12} cy={12} r={6} />
      <Circle cx={12} cy={12} r={1.8} fill={color} />
      <Path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22" />
    </Svg>
  );
}

/** Shield with a check: protected land. */
export function ShieldIcon({ size = 22, color = colors.noticeInk }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round">
      <Path d="M12 3 L19 6 V11 C19 15.5, 16 19, 12 21 C 8 19, 5 15.5, 5 11 V6 Z" />
      <Path d="M9 12 L11 14 L15 10" />
    </Svg>
  );
}

/** Chevron, pointing down (or up when open). */
export function ChevronIcon({ size = 20, color = colors.ink, up = false }: IconProps & { up?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d={up ? 'M6 15 L12 9 L18 15' : 'M6 9 L12 15 L18 9'} />
    </Svg>
  );
}

/** A compass needle pointing along a bearing (degrees clockwise from north). */
export function BearingIcon({ size = 16, color = colors.accent, bearing = 0 }: IconProps & { bearing?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" style={{ transform: [{ rotate: `${bearing}deg` }] }}>
      <Path d="M8 2 L12 12 L8 9.5 L4 12 Z" fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

/** Camera with a lens: identify a rock. */
export function CameraIcon({ size = 20, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round">
      <Path d="M4 8 H8 L9.5 5.5 H14.5 L16 8 H20 V19 H4 Z" />
      <Circle cx={12} cy={13} r={3.5} />
    </Svg>
  );
}

/** An open book: the catalog. */
export function BookIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round">
      <Path d="M3 5 C 6 4, 9 4.5, 12 6.5 C 15 4.5, 18 4, 21 5 V19 C 18 18, 15 18.5, 12 20 C 9 18.5, 6 18, 3 19 Z" />
      <Path d="M12 6.5 V20" />
    </Svg>
  );
}

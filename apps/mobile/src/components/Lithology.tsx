import { useId, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '../theme';

/**
 * Rock patterns in the conventions geologic maps use (gravel as circles,
 * sandstone as dots, shale as dashes, limestone as brick, volcanic rock as
 * Vs, crystalline rock as crosses). They give the app a geologist's visual
 * language without borrowing any book's design.
 */
export type Lithology = 'gravel' | 'sandstone' | 'shale' | 'limestone' | 'volcanic' | 'crystalline' | 'plain';

const FILL: Record<Lithology, string> = {
  gravel: '#e6dcc4',
  sandstone: '#e3b977',
  shale: '#a9b39a',
  limestone: '#a8c3d1',
  volcanic: '#d9a08f',
  crystalline: '#c9b8c4',
  plain: '#ddd3c1',
};

const INK: Record<Lithology, string> = {
  gravel: '#6b5d45',
  sandstone: '#5a4220',
  shale: '#3d4634',
  limestone: '#2f4a58',
  volcanic: '#5e2a1d',
  crystalline: '#4c3a49',
  plain: '#6b5d45',
};

/** The marks inside one tile of a pattern. */
function marks(kind: Lithology): { w: number; h: number; draw: ReactNode } {
  const ink = INK[kind];
  switch (kind) {
    case 'gravel':
      return {
        w: 18,
        h: 14,
        draw: (
          <>
            <Circle cx={4} cy={4} r={2.2} fill="none" stroke={ink} strokeWidth={1} />
            <Circle cx={13} cy={10} r={2.8} fill="none" stroke={ink} strokeWidth={1} />
          </>
        ),
      };
    case 'sandstone':
      return {
        w: 10,
        h: 10,
        draw: (
          <>
            <Circle cx={2} cy={3} r={0.9} fill={ink} />
            <Circle cx={7} cy={8} r={0.9} fill={ink} />
          </>
        ),
      };
    case 'shale':
      return {
        w: 20,
        h: 8,
        draw: (
          <>
            <Line x1={1} y1={4} x2={9} y2={4} stroke={ink} strokeWidth={1.2} />
            <Line x1={12} y1={4} x2={18} y2={4} stroke={ink} strokeWidth={1.2} />
          </>
        ),
      };
    case 'limestone':
      return {
        w: 24,
        h: 12,
        draw: <Path d="M0 0 H24 M0 6 H24 M6 0 V6 M18 6 V12" stroke={ink} strokeWidth={1} fill="none" />,
      };
    case 'volcanic':
      return {
        w: 16,
        h: 12,
        draw: <Path d="M2 3 L5 9 L8 3 M10 5 L12 9 L14 5" stroke={ink} strokeWidth={1.1} fill="none" />,
      };
    case 'crystalline':
      return {
        w: 14,
        h: 14,
        draw: <Path d="M3 3 L6 6 M6 3 L3 6 M10 9 L13 12 M13 9 L10 12" stroke={ink} strokeWidth={1} fill="none" />,
      };
    default:
      return { w: 10, h: 10, draw: null };
  }
}

function PatternDef({ id, kind }: { id: string; kind: Lithology }) {
  const { w, h, draw } = marks(kind);
  return (
    <Pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
      <Rect width={w} height={h} fill={FILL[kind]} />
      {draw}
    </Pattern>
  );
}

/** Picks a pattern from a formation's rock types, e.g. ["Andesite"] → volcanic. */
export function lithologyFor(rockTypes: string[] | null | undefined): Lithology {
  const text = (rockTypes ?? []).join(' ').toLowerCase();
  if (/(andesite|basalt|rhyolite|dacite|tuff|volcanic|trachy|latite|lava)/.test(text)) return 'volcanic';
  if (/(limestone|dolostone|dolomite|carbonate|marble)/.test(text)) return 'limestone';
  if (/(conglomerate|unconsolidated|gravel|alluvium|till|colluvium)/.test(text)) return 'gravel';
  if (/(sandstone|quartzite|arkose|sand)/.test(text)) return 'sandstone';
  if (/(shale|mudstone|siltstone|claystone|marl|argillite|slate)/.test(text)) return 'shale';
  if (/(granite|gneiss|schist|diorite|gabbro|granodiorite|intrusive|amphibolite|anorthosite)/.test(text)) {
    return 'crystalline';
  }
  return 'plain';
}

/** A small square of a rock pattern, for lists. */
export function LithologySwatch({ kind, size = 30 }: { kind: Lithology; size?: number }) {
  const id = `sw-${kind}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <PatternDef id={id} kind={kind} />
      </Defs>
      <Rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={4} fill={`url(#${id})`} stroke={colors.ink} />
    </Svg>
  );
}

/** A framed rectangle of one rock pattern, for illustration panels. */
export function LithologyPanel({ kind, width, height }: { kind: Lithology; width: number; height: number }) {
  const id = `pn-${kind}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <PatternDef id={id} kind={kind} />
      </Defs>
      <Rect x={1} y={1} width={width - 2} height={height - 2} rx={14} fill={`url(#${id})`} stroke={colors.ink} />
    </Svg>
  );
}

const STRATA: { kind: Lithology; top: string; label: string; labelX: number; labelY: number }[] = [
  { kind: 'gravel', top: 'M1 40 C 70 28, 120 48, 180 34 S 300 22, 341 38', label: 'GRAVEL', labelX: 276, labelY: 56 },
  { kind: 'sandstone', top: 'M1 66 C 80 58, 150 86, 220 70 S 310 54, 341 64', label: 'SANDSTONE', labelX: 260, labelY: 90 },
  { kind: 'shale', top: 'M1 106 C 80 98, 160 128, 230 110 S 312 92, 341 102', label: 'SHALE', labelX: 276, labelY: 126 },
  { kind: 'limestone', top: 'M1 140 C 90 132, 160 162, 240 144 S 316 128, 341 136', label: 'LIMESTONE', labelX: 262, labelY: 160 },
  { kind: 'volcanic', top: 'M1 178 C 90 172, 170 196, 246 180 S 318 166, 341 172', label: 'VOLCANIC', labelX: 268, labelY: 196 },
  { kind: 'crystalline', top: 'M1 214 C 90 208, 176 228, 250 214 S 320 204, 341 208', label: 'GRANITE', labelX: 270, labelY: 234 },
];

/**
 * A folded cross-section of labelled rock layers, oldest at the bottom: the
 * landing page's illustration. Drawn at 342×252 and scaled to `width`.
 */
export function StrataIllustration({ width = 342 }: { width?: number }) {
  const prefix = `st-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const drawnWidth = Math.floor(width);
  const height = Math.floor((drawnWidth * 252) / 342);
  const clipId = `${prefix}-frame`;
  const label = (layer: (typeof STRATA)[number], halo: boolean) => (
    <SvgText
      key={`${halo ? 'halo' : 'label'}-${layer.kind}`}
      x={layer.labelX}
      y={layer.labelY}
      fontFamily="BarlowCondensed_600SemiBold"
      fontSize={11}
      letterSpacing={0.6}
      fill={colors.ink}
      // A paper-coloured outline drawn underneath keeps the label readable
      // over the busy patterns.
      {...(halo ? { stroke: colors.card, strokeWidth: 3.5, strokeLinejoin: 'round' as const } : {})}
    >
      {layer.label}
    </SvgText>
  );
  return (
    <Svg width={drawnWidth} height={height} viewBox="0 0 342 252">
      <Defs>
        {STRATA.map((layer) => (
          <PatternDef key={layer.kind} id={`${prefix}-${layer.kind}`} kind={layer.kind} />
        ))}
        {/* The layers are drawn with square corners; clip them to the frame. */}
        <ClipPath id={clipId}>
          <Rect x={0.5} y={0.5} width={341} height={251} rx={14} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0.5} y={0.5} width={341} height={251} rx={14} fill={colors.paper} />
        {STRATA.map((layer) => (
          <Path key={layer.kind} d={`${layer.top} L341 251 L1 251 Z`} fill={`url(#${prefix}-${layer.kind})`} />
        ))}
        {STRATA.map((layer, i) => (
          <Path key={`line-${layer.kind}`} d={layer.top} fill="none" stroke={colors.ink} strokeWidth={i === 0 ? 1.6 : 0.8} />
        ))}
        {STRATA.map((layer) => label(layer, true))}
        {STRATA.map((layer) => label(layer, false))}
      </G>
      <Rect x={0.5} y={0.5} width={341} height={251} rx={14} fill="none" stroke={colors.ink} strokeWidth={1} />
    </Svg>
  );
}

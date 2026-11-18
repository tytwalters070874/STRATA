import { StyleSheet, Text, View } from 'react-native';

import { formatAgo, placeInTime, RIBBON_SEGMENTS } from '../data/geologicTime';

interface TimeRibbonProps {
  /** Youngest age of the rock, in millions of years ago. */
  minMa: number;
  /** Oldest age of the rock, in millions of years ago. */
  maxMa: number;
}

// Each era gets a fixed share of the ribbon. Drawn to true scale, the last
// 539 million years would be a sliver, and most rocks here are from them.
const SHARES = [0.25, 0.25, 0.25, 0.25];

/** Position 0–1 along the ribbon for an age in Ma (0 = Earth's start, 1 = today). */
function position(ma: number): number {
  let offset = 0;
  for (let i = 0; i < RIBBON_SEGMENTS.length; i++) {
    const seg = RIBBON_SEGMENTS[i];
    if (ma <= seg.start && ma >= seg.end) {
      return offset + SHARES[i] * ((seg.start - ma) / (seg.start - seg.end));
    }
    offset += SHARES[i];
  }
  return ma > RIBBON_SEGMENTS[0].start ? 0 : 1;
}

/**
 * Where a rock sits in Earth's history: a ribbon of the four great eras with
 * the rock's age marked, the age in words, and a line placing it among
 * familiar events.
 */
export default function TimeRibbon({ minMa, maxMa }: TimeRibbonProps) {
  const left = position(maxMa);
  const right = position(minMa);
  const middle = (minMa + maxMa) / 2;
  const placed = placeInTime(minMa, maxMa);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Formed about ${formatAgo(middle)}. ${placed ?? ''}`}
    >
      <Text style={styles.headline}>Formed about {formatAgo(middle)}</Text>
      <View style={styles.ribbon}>
        {RIBBON_SEGMENTS.map((seg, i) => (
          <View key={seg.name} style={[styles.segment, { flex: SHARES[i], backgroundColor: seg.color }]} />
        ))}
        <View
          style={[
            styles.marker,
            { left: `${left * 100}%`, width: `${Math.max(1.5, (right - left) * 100)}%` },
          ]}
        />
      </View>
      <View style={styles.labels}>
        {RIBBON_SEGMENTS.map((seg, i) => (
          <Text key={seg.name} style={[styles.label, { flex: SHARES[i] }]} numberOfLines={1}>
            {seg.name}
          </Text>
        ))}
      </View>
      {placed && <Text style={styles.placed}>{placed}</Text>}
      <Text style={styles.scaleNote}>Earth's history, eras not to scale</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1b16',
  },
  ribbon: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#1d1b16',
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 11,
    color: '#6b665c',
    textAlign: 'center',
  },
  placed: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4a463e',
  },
  scaleNote: {
    fontSize: 11,
    color: '#8a857a',
  },
});

import { StyleSheet, Text, View } from 'react-native';

export const CONFIDENCE_COLORS = {
  high: '#2e9e5b',
  moderate: '#d9a21b',
  low: '#d4453a',
} as const;

const LABELS = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  low: 'Low confidence',
} as const;

// Same thresholds the identify-rock function uses for confidence_tier.
export function confidenceLevel(confidence: number): keyof typeof CONFIDENCE_COLORS {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'moderate';
  return 'low';
}

interface ConfidenceMeterProps {
  /** 0–1 */
  confidence: number;
}

export default function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  const level = confidenceLevel(clamped);
  const color = CONFIDENCE_COLORS[level];

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={LABELS[level]}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.level, { color }]}>{LABELS[level]}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
        {/* Tick marks at the tier boundaries */}
        <View style={[styles.tick, { left: '50%' }]} />
        <View style={[styles.tick, { left: '80%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  level: {
    fontSize: 15,
    fontWeight: '700',
  },
  percent: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a463e',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ebe8e2',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

// PRD 3.3: teal for a strong match, amber for likely, coral for possible.
export const CONFIDENCE_COLORS = {
  high: '#1f8a87',
  moderate: '#d9a21b',
  low: '#d4453a',
} as const;

type Level = keyof typeof CONFIDENCE_COLORS;

const LABELS: Record<Level, string> = {
  high: 'Strong match',
  moderate: 'Likely match',
  low: 'Possible match',
};

// PRD 3.3 wording, reworded for rock type: the photo no longer names a formation.
const EXPLANATIONS: Record<Level, string> = {
  high: 'This identification is well supported by the photo and location data.',
  moderate: 'The photo and location suggest this rock type, but a closer look in the field is recommended.',
  low: 'Limited visual evidence. This is the most likely rock type here, but others are plausible.',
};

// Same thresholds the identify-rock function uses for confidence_tier.
export function confidenceLevel(confidence: number): Level {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'moderate';
  return 'low';
}

interface ConfidenceMeterProps {
  /** 0–1 */
  confidence: number;
  /** Show the one-sentence explanation of the tier. Off for compact lists. */
  explain?: boolean;
}

export default function ConfidenceMeter({ confidence, explain = true }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  const level = confidenceLevel(clamped);
  const color = CONFIDENCE_COLORS[level];

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${LABELS[level]}. ${explain ? EXPLANATIONS[level] : ''}`}
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
      {explain && <Text style={styles.explanation}>{EXPLANATIONS[level]}</Text>}
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
    fontFamily: fonts.labelBold,
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  percent: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.ink,
  },
  explanation: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
  },
});

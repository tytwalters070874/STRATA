import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTour } from '../lib/tour';

// The same earth-tone bands as the landing page; the band for the current
// step is drawn taller, so the column reads as progress.
const BANDS = ['#4f6b6a', '#b9965f', '#6b4f2a'];

const STEPS = [
  {
    title: 'Read the ground beneath you',
    body:
      'Tap anywhere on the map to see the rock under that spot: what it is, how it formed, and how old it is. ' +
      "Start with the plain summary, then open the geologist's view to go deeper.",
  },
  {
    title: 'Identify a rock',
    body:
      'Photograph a rock and STRATA suggests what it is, and how sure it is. ' +
      'Identifying rocks and saving them to a catalog need a free account.',
  },
  {
    title: 'A field guide, not a lab',
    body:
      'Results come from geologic maps and AI, so use them to learn and explore. ' +
      'Some places are protected: check with the agency in charge before collecting anything. If in doubt, do not collect.',
  },
];

/** Three short screens shown once after the landing page, and again from the map's help button. */
export default function TourScreen() {
  const insets = useSafeAreaInsets();
  const { finish } = useTour();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={finish} style={styles.skip} hitSlop={12} accessibilityRole="button">
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.column} accessibilityElementsHidden importantForAccessibility="no">
        {BANDS.map((color, i) => (
          <View key={color} style={[styles.band, { backgroundColor: color, flex: i === step ? 3 : 1 }]} />
        ))}
      </View>

      <View style={styles.text} accessibilityLiveRegion="polite">
        <Text style={styles.stepLabel}>
          {step + 1} of {STEPS.length}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {STEPS[step].title}
        </Text>
        <Text style={styles.body}>{STEPS[step].body}</Text>
      </View>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
        <Pressable
          onPress={isLast ? finish : () => setStep(step + 1)}
          style={styles.primaryButton}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{isLast ? 'Start exploring' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f4f0',
    paddingHorizontal: 24,
    gap: 24,
  },
  skip: {
    alignSelf: 'flex-end',
    minHeight: 48,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b4f2a',
  },
  column: {
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
  },
  band: {
    width: '100%',
  },
  text: {
    flex: 1,
    gap: 12,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a857a',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1d1b16',
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
    color: '#4a463e',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  spacer: {
    flex: 1,
  },
  primaryButton: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#6b4f2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c9c2b4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#3a372f',
    fontSize: 16,
    fontWeight: '600',
  },
});

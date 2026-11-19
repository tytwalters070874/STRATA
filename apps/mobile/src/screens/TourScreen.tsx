import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, LayersIcon, ShieldIcon } from '../components/Icons';
import { LithologyPanel, type Lithology } from '../components/Lithology';
import { useTour } from '../lib/tour';
import { colors, fonts } from '../theme';

const STEPS: { title: string; body: string; pattern: Lithology; icon: ReactNode }[] = [
  {
    title: 'Read the ground beneath you',
    body:
      'Tap anywhere on the map to see the rock under that spot: what it is, how it formed, and how old it is. ' +
      "Start with the plain summary, then open the geologist's view to go deeper.",
    pattern: 'sandstone',
    icon: <LayersIcon size={34} />,
  },
  {
    title: 'Identify a rock',
    body:
      'Photograph a rock and STRATA suggests what it is, and how sure it is. ' +
      'Identifying rocks and saving them to a catalog need a free account.',
    pattern: 'volcanic',
    icon: <CameraIcon size={34} color={colors.ink} />,
  },
  {
    title: 'A field guide, not a lab',
    body:
      'Results come from geologic maps and AI, so use them to learn and explore. ' +
      'Some places are protected: check with the agency in charge before collecting anything. If in doubt, do not collect.',
    pattern: 'limestone',
    icon: <ShieldIcon size={34} color={colors.ink} />,
  },
];

/** Three short screens shown once after the landing page, and again from the map's help button. */
export default function TourScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { finish } = useTour();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const panelWidth = Math.min(width - 48, 420);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={finish} style={styles.skip} hitSlop={12} accessibilityRole="button">
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.panel} accessibilityElementsHidden importantForAccessibility="no">
        <LithologyPanel key={current.pattern} kind={current.pattern} width={panelWidth} height={170} />
        <View style={styles.badge}>{current.icon}</View>
      </View>

      <View style={styles.text} accessibilityLiveRegion="polite">
        <Text style={styles.stepLabel}>
          {step + 1} of {STEPS.length}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {current.title}
        </Text>
        <Text style={styles.body}>{current.body}</Text>
      </View>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === step && styles.dotOn]} />
        ))}
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
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
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
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    gap: 24,
  },
  skip: {
    alignSelf: 'flex-end',
    minHeight: 48,
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
  panel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 12,
  },
  stepLabel: {
    fontFamily: fonts.label,
    fontSize: 13,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    color: colors.inkSoft,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  dotOn: {
    backgroundColor: colors.ink,
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
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: '#fff',
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.ink,
  },
});

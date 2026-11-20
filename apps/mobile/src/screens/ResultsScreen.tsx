import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ConfidenceMeter from '../components/ConfidenceMeter';
import GlossaryText from '../components/GlossaryText';
import { define } from '../data/glossary';
import { useSaveToCatalog } from '../hooks/useSaveToCatalog';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, fonts, labelStyle } from '../theme';

export default function ResultsScreen({ navigation, route }: RootStackScreenProps<'Results'>) {
  const insets = useSafeAreaInsets();
  const { result, photoUri, lat, lng } = route.params;
  const { isSaved, isChecking, save, isSaving, error } = useSaveToCatalog(result.identification_id);

  const isNotRock = result.rock_type.toLowerCase() === 'not a rock';
  // The server already classified the confidence; use its tier, not a copy of the thresholds.
  const isLowConfidence = result.confidence_tier === 'low';
  // The formation comes from the map, not the photo: it is kept only so the
  // catalog entry can reference it when saved.
  const mapped = result.mapped_formation;
  const canSave = result.identification_id != null && !isNotRock;
  const alternates = result.alternates ?? [];
  // "arkosic sandstone" → the glossary entry for the whole name, else its last word.
  const rockDefinition = isNotRock
    ? null
    : define(result.rock_type) ?? define(result.rock_type.split(/\s+/).pop() ?? '');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

        <View style={styles.card}>
          {isNotRock ? (
            // A confidence score means nothing when there is no rock to score,
            // so this state gets its own title and advice instead of "0%".
            <>
              <Text style={styles.rockType}>No rock found</Text>
              <Text style={styles.hint}>
                Fill the guide box with the rock, close up, in even daylight.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.rockType, styles.capitalize]}>{result.rock_type}</Text>
              {rockDefinition && <Text style={styles.definition}>{rockDefinition}</Text>}
              <ConfidenceMeter confidence={result.confidence} />
              {isLowConfidence && (
                <Text style={styles.hint}>
                  Try a closer photo of a fresh, broken surface in even light, with something for scale.
                </Text>
              )}
            </>
          )}
        </View>

        {result.minerals_visible.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Minerals visible</Text>
            <View style={styles.chips}>
              {result.minerals_visible.map((mineral) => (
                <View key={mineral} style={styles.chip}>
                  <Text style={styles.chipText}>{mineral}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why</Text>
          <GlossaryText style={styles.body}>{result.reasoning}</GlossaryText>
        </View>

        {!isNotRock && alternates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Other possibilities</Text>
            {alternates.map((alt) => (
              <View key={alt.rock_type} style={styles.alternateRow}>
                <GlossaryText style={[styles.alternateName, styles.capitalize]}>{alt.rock_type}</GlossaryText>
                <Text style={styles.alternateScore}>{Math.round(alt.confidence * 100)}%</Text>
              </View>
            ))}
          </View>
        )}

        {result.ai_provider === 'openai' && (
          <Text style={styles.meta}>Identified by the backup model ({result.model}).</Text>
        )}

        {/* PRD 3.3: always shown, not dismissible. */}
        <Text style={styles.disclaimer}>
          AI identification is a field aid, not a scientific determination. Results should be verified
          against official geologic survey records.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {error && <Text style={styles.error}>{error.message}</Text>}
        {!canSave && !isNotRock && (
          <Text style={styles.meta}>This result wasn't recorded, so it can't be saved. Try again.</Text>
        )}
        <View style={styles.footerButtons}>
          {isNotRock ? (
            // Nothing to save, so retaking is the one useful action.
            <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>Retake photo</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
          )}
          {isNotRock ? null : isSaved ? (
            <Pressable style={styles.primaryButton} onPress={() => navigation.popTo('Map')}>
              <Text style={styles.primaryButtonText}>Saved ✓  Back to map</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, (!canSave || isSaving || isChecking) && styles.disabled]}
              disabled={!canSave || isSaving || isChecking}
              onPress={() => save({ formationId: mapped?.id ?? null, lat, lng })}
              accessibilityRole="button"
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save to catalog</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.rule,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  rockType: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.ink,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  hint: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  sectionTitle: {
    ...labelStyle,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowLabel: {
    width: 100,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
  },
  rowValue: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
  },
  chipText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkSoft,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  definition: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  alternateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  alternateName: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.ink,
  },
  alternateScore: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  disclaimer: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 2,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
});

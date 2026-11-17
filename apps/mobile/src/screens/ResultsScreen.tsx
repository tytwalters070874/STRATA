import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ConfidenceMeter from '../components/ConfidenceMeter';
import { useSaveToCatalog } from '../hooks/useSaveToCatalog';
import type { RootStackScreenProps } from '../navigation/types';

export default function ResultsScreen({ navigation, route }: RootStackScreenProps<'Results'>) {
  const insets = useSafeAreaInsets();
  const { result, photoUri, lat, lng } = route.params;
  const { isSaved, isChecking, save, isSaving, error } = useSaveToCatalog(result.identification_id);

  const isNotRock = result.rock_type.toLowerCase() === 'not a rock';
  // The server already classified the confidence; use its tier, not a copy of the thresholds.
  const isLowConfidence = result.confidence_tier === 'low';
  const mapped = result.mapped_formation;
  const guessMatchesMap =
    mapped != null &&
    result.formation_guess != null &&
    result.formation_guess.toLowerCase() === mapped.name.toLowerCase();
  const canSave = result.identification_id != null && !isNotRock;

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
              <ConfidenceMeter confidence={result.confidence} />
              {isLowConfidence && (
                <Text style={styles.hint}>
                  Try a closer photo of a fresh, broken surface in even light, with something for scale.
                </Text>
              )}
            </>
          )}
        </View>

        {(result.formation_guess || mapped) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Formation</Text>
            {result.formation_guess && (
              <Row label="Likely source" value={result.formation_guess} />
            )}
            {mapped && !guessMatchesMap && (
              <Row
                label="Mapped here"
                value={[mapped.name, mapped.map_unit_symbol && `(${mapped.map_unit_symbol})`]
                  .filter(Boolean)
                  .join(' ')}
              />
            )}
            {mapped?.geologic_age && <Row label="Age" value={mapped.geologic_age} />}
          </View>
        )}

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
          <Text style={styles.body}>{result.reasoning}</Text>
        </View>

        {result.ai_provider === 'openai' && (
          <Text style={styles.meta}>Identified by the backup model ({result.model}).</Text>
        )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f4f0',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    backgroundColor: '#e3dfd7',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  rockType: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1d1b16',
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  hint: {
    fontSize: 14,
    color: '#6b665c',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a857a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowLabel: {
    width: 100,
    fontSize: 15,
    color: '#8a857a',
  },
  rowValue: {
    flex: 1,
    fontSize: 15,
    color: '#1d1b16',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f2f0ec',
  },
  chipText: {
    fontSize: 14,
    color: '#3a372f',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3a372f',
  },
  meta: {
    fontSize: 12,
    color: '#8a857a',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd8ce',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 2,
    height: 48,
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
    height: 48,
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
  disabled: {
    opacity: 0.45,
  },
  error: {
    fontSize: 13,
    color: '#d4453a',
    textAlign: 'center',
  },
});

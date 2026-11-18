import { Image } from 'expo-image';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Formation } from '../hooks/useFormation';
import { useFormationImages } from '../hooks/useFormationImages';
import { useMacrostratUnit } from '../hooks/useMacrostratUnit';

interface FormationDetailsProps {
  formation: Formation;
  /** The map point the formation was looked up at; Macrostrat details are for this point. */
  point: { lat: number; lng: number };
}

/** Rounds an age in Ma for display: 1 decimal under 10 Ma, whole numbers above. */
function formatMa(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

/**
 * The formation under a map point: name, map unit, period and age, rock types,
 * environment of deposition, description, example photos and source.
 *
 * The imported formation table only has the name, map unit, rock types and a
 * rock class (stored in its geologic_age column). Age, description,
 * environment and source come from Macrostrat for the same point.
 */
export default function FormationDetails({ formation, point }: FormationDetailsProps) {
  const { data: images } = useFormationImages(formation.name);
  const macrostrat = useMacrostratUnit(point);
  const unit = macrostrat.data ?? null;

  const ageText = unit
    ? [unit.period, unit.ageMa && `${formatMa(unit.ageMa.min)}–${formatMa(unit.ageMa.max)} Ma`]
        .filter(Boolean)
        .join(' · ')
    : null;
  // The import wrote "<name> — <rock class>" as the description; it adds nothing.
  const ownDescription =
    formation.description && !formation.description.startsWith(`${formation.name} —`)
      ? formation.description
      : null;
  const description = unit?.description ?? ownDescription;
  const sourceUrl = formation.source_url ?? unit?.sourceUrl ?? null;
  // Macrostrat's unit can come from a different map than the formation table.
  const unitDiffers = unit != null && unit.name.toLowerCase() !== formation.name.toLowerCase();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {formation.name}
        </Text>
        {formation.map_unit_symbol && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formation.map_unit_symbol}</Text>
          </View>
        )}
      </View>

      {ageText ? <Text style={styles.age}>{ageText}</Text> : null}
      {formation.geologic_age && <Text style={styles.meta}>Rock class: {formation.geologic_age}</Text>}

      {formation.rock_types && formation.rock_types.length > 0 && (
        <View style={styles.chips}>
          {formation.rock_types.map((rock) => (
            <View key={rock} style={styles.chip}>
              <Text style={styles.chipText}>{rock}</Text>
            </View>
          ))}
        </View>
      )}

      {unit && unit.environments.length > 0 && (
        <Text style={styles.body}>
          <Text style={styles.label}>Deposited in: </Text>
          {unit.environments.join(', ')}
        </Text>
      )}

      {description && <Text style={styles.body}>{description}</Text>}

      {macrostrat.isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.meta}>Loading age and description…</Text>
        </View>
      )}
      {!macrostrat.isLoading && !unit && !ownDescription && (
        <Text style={styles.meta}>
          {macrostrat.error ? 'Age and description unavailable offline.' : 'No detailed description for this spot.'}
        </Text>
      )}

      {images && images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {images.map((image) => (
            <View key={image.id} style={styles.imageCard}>
              <Image source={{ uri: image.url }} style={styles.image} contentFit="cover" transition={150} />
              {(image.caption || image.credit) && (
                <Text style={styles.credit} numberOfLines={2}>
                  {[image.caption, image.credit && `Photo: ${image.credit}`].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {sourceUrl && (
        <Pressable onPress={() => Linking.openURL(sourceUrl)} accessibilityRole="link" style={styles.sourceButton}>
          <Text style={styles.sourceText}>View source</Text>
        </Pressable>
      )}
      {unit && (
        <Text style={styles.attribution}>
          {unitDiffers ? `Details for Macrostrat unit "${unit.name}". ` : ''}Unit data: Macrostrat (CC BY 4.0).
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1b16',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#efe6d8',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b4f2a',
  },
  age: {
    fontSize: 15,
    color: '#4a463e',
  },
  meta: {
    fontSize: 13,
    color: '#8a857a',
  },
  label: {
    fontWeight: '600',
    color: '#3a372f',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attribution: {
    fontSize: 11,
    color: '#8a857a',
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
    fontSize: 13,
    color: '#3a372f',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#3a372f',
  },
  images: {
    gap: 10,
    paddingVertical: 4,
  },
  imageCard: {
    width: 220,
    gap: 4,
  },
  image: {
    width: 220,
    height: 150,
    borderRadius: 10,
    backgroundColor: '#e3dfd7',
  },
  credit: {
    fontSize: 12,
    color: '#6b665c',
  },
  sourceButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
  sourceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b4f2a',
  },
});

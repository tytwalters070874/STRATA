import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Formation } from '../hooks/useFormation';
import { useFormationImages } from '../hooks/useFormationImages';
import { useFormationSummary } from '../hooks/useFormationSummary';
import { useMacrostratUnit } from '../hooks/useMacrostratUnit';
import { compass, formatDistance, useNearbyFormations } from '../hooks/useNearbyFormations';
import { useProtectedArea } from '../hooks/useProtectedArea';
import GlossaryText from './GlossaryText';
import TimeRibbon from './TimeRibbon';

interface FormationDetailsProps {
  formation: Formation;
  /** The map point the formation was looked up at. */
  point: { lat: number; lng: number };
  /** Called when a nearby formation is chosen, with a point on its nearest edge. */
  onSelectPoint?: (point: { lat: number; lng: number }) => void;
}

/** Rounds an age in Ma for display: 1 decimal under 10 Ma, whole numbers above. */
function formatMa(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

/**
 * The formation under a map point, layered for a reader with no geology
 * background: a plain summary and how it formed come first, then rocks
 * nearby and photos, and the geologist's details last, collapsed.
 *
 * Sources: the formation table (name, map unit, rock types, and a rock class
 * in its geologic_age column); formation_summaries (AI-written plain text);
 * Macrostrat for the point (age, description, environment); NPS and BIA
 * boundaries for the protected-area notice.
 */
export default function FormationDetails({ formation, point, onSelectPoint }: FormationDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: images } = useFormationImages(formation.name);
  const { data: summary } = useFormationSummary(formation.name);
  const { data: protectedAreas } = useProtectedArea(point);
  const nearby = useNearbyFormations(point);
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
  // Known from the point alone, so the link is there before anything loads
  // and never moves when content arrives below it.
  const sourceUrl = formation.source_url ?? `https://macrostrat.org/map/loc/${point.lng}/${point.lat}`;
  const openSource = () => {
    Linking.openURL(sourceUrl).catch(() =>
      Alert.alert("Couldn't open the source", 'No app on this phone can open web links.'),
    );
  };
  // Macrostrat's unit can come from a different map than the formation table.
  const unitDiffers = unit != null && unit.name.toLowerCase() !== formation.name.toLowerCase();

  return (
    <View style={styles.container}>
      {protectedAreas && protectedAreas.length > 0 && (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>
            {protectedAreas.map((area) => `${area.name} (${area.kind})`).join(' · ')}
          </Text>
          <Text style={styles.noticeBody}>
            This is protected land. See the applicable agencies for collection rules. If in doubt, do not
            collect.
          </Text>
        </View>
      )}

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

      <Pressable
        onPress={openSource}
        accessibilityRole="link"
        accessibilityLabel={`View source for ${formation.name}`}
        hitSlop={8}
        style={styles.sourceButton}
      >
        <Text style={styles.sourceText}>View source ›</Text>
      </Pressable>

      {/* 1. What you're standing on */}
      {summary ? (
        <View style={styles.section}>
          <GlossaryText style={styles.lead}>{summary.summary}</GlossaryText>
          {summary.source === 'ai' && !summary.reviewed && (
            <Text style={styles.aiLabel}>AI-written summary, not yet reviewed by a geologist</Text>
          )}
        </View>
      ) : null}

      {/* 2. How it formed */}
      {(summary?.how_it_formed || (unit && unit.environments.length > 0) || unit?.ageMa) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it formed</Text>
          {summary?.how_it_formed ? (
            <GlossaryText style={styles.body}>{summary.how_it_formed}</GlossaryText>
          ) : unit && unit.environments.length > 0 ? (
            <GlossaryText style={styles.body}>{`Laid down in: ${unit.environments.join(', ')}.`}</GlossaryText>
          ) : null}
          {unit?.ageMa && <TimeRibbon minMa={unit.ageMa.min} maxMa={unit.ageMa.max} />}
        </View>
      )}

      {/* 3. Rocks nearby */}
      {nearby.data && nearby.data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rocks nearby</Text>
          {nearby.data.map((item) => (
            <Pressable
              key={item.name}
              style={styles.nearbyRow}
              onPress={() => onSelectPoint?.({ lat: item.edge_lat, lng: item.edge_lng })}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDistance(item.distance_m)} ${compass(item.bearing_deg)}`}
            >
              <View style={styles.nearbyText}>
                <Text style={styles.nearbyRocks} numberOfLines={1}>
                  {item.rock_types?.length ? item.rock_types.join(', ') : 'Rock'}
                </Text>
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.nearbyDistance}>
                {formatDistance(item.distance_m)} {compass(item.bearing_deg)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 4. Example photos */}
      {images && images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {images.map((image) => (
            <View key={image.id} style={styles.imageCard}>
              <Image
                source={{ uri: image.url }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                accessibilityLabel={image.caption ?? `Example photo of ${formation.name}`}
              />
              {(image.caption || image.credit) && (
                <Text style={styles.credit} numberOfLines={2}>
                  {[image.caption, image.credit && `Photo: ${image.credit}`].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* 5. Geologist's view */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.expander}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.expanderText}>Geologist's view</Text>
        <Text style={styles.expanderIcon}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.section}>
          {ageText ? <GlossaryText style={styles.age}>{ageText}</GlossaryText> : null}
          {formation.geologic_age && (
            <GlossaryText style={styles.meta}>{`Rock class: ${formation.geologic_age}`}</GlossaryText>
          )}

          {formation.rock_types && formation.rock_types.length > 0 && (
            <View style={styles.chips}>
              {formation.rock_types.map((rock) => (
                <View key={rock} style={styles.chip}>
                  <GlossaryText style={styles.chipText}>{rock}</GlossaryText>
                </View>
              ))}
            </View>
          )}

          {unit && unit.environments.length > 0 && (
            <GlossaryText style={styles.body}>{`Deposited in: ${unit.environments.join(', ')}`}</GlossaryText>
          )}

          {description && <GlossaryText style={styles.body}>{description}</GlossaryText>}

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

          {unit && (
            <Text style={styles.attribution}>
              {unitDiffers ? `Details for Macrostrat unit "${unit.name}". ` : ''}Unit data: Macrostrat (CC BY 4.0).
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  notice: {
    borderLeftWidth: 4,
    borderLeftColor: '#b5651d',
    backgroundColor: '#fbf1e6',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5a3410',
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5a3410',
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
  sourceButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -6,
  },
  sourceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b4f2a',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a857a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lead: {
    fontSize: 17,
    lineHeight: 25,
    color: '#1d1b16',
  },
  aiLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#8a857a',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#3a372f',
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6e1d8',
  },
  nearbyText: {
    flex: 1,
  },
  nearbyRocks: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1b16',
    textTransform: 'capitalize',
  },
  nearbyName: {
    fontSize: 13,
    color: '#6b665c',
  },
  nearbyDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b4f2a',
    fontVariant: ['tabular-nums'],
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
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e1d8',
  },
  expanderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6b4f2a',
  },
  expanderIcon: {
    fontSize: 16,
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
});

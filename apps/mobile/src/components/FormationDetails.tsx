import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Formation } from '../hooks/useFormation';
import { useFormationImages } from '../hooks/useFormationImages';
import { useFormationSummary } from '../hooks/useFormationSummary';
import { useMacrostratUnit } from '../hooks/useMacrostratUnit';
import { compass, formatDistance, useNearbyFormations } from '../hooks/useNearbyFormations';
import { useProtectedArea } from '../hooks/useProtectedArea';
import { macrostratAgeFits } from '../lib/mapUnitAge';
import { plainRockTypes, shortFormationName, splitFormationName } from '../lib/names';
import { colors, fonts, labelStyle } from '../theme';
import GlossaryText from './GlossaryText';
import { BearingIcon, ChevronIcon, ShieldIcon } from './Icons';
import { lithologyFor, LithologySwatch } from './Lithology';
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

/** A section heading set like a guidebook running head: small caps and a rule. */
function SectionHead({ children }: { children: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {children}
      </Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

/**
 * The formation under a map point, set like a field-guide page for a reader
 * with no geology background: a plain summary and how it formed come first,
 * then rocks nearby and photos, and the geologist's details last, collapsed.
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
  // Macrostrat can match a different rock than the formation here; when its
  // age contradicts the map unit's, none of its details are about this rock.
  const unit =
    macrostrat.data &&
    (!macrostrat.data.ageMa || macrostratAgeFits(formation.map_unit_symbol, macrostrat.data.ageMa))
      ? macrostrat.data
      : null;
  const { title, parent } = splitFormationName(formation.name);

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
        <View style={styles.notice} accessible accessibilityRole="alert">
          <View style={styles.noticeIcon}>
            <ShieldIcon />
          </View>
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>
              Protected land · {protectedAreas.map((area) => `${area.name} (${area.kind})`).join(' · ')}
            </Text>
            <Text style={styles.noticeBody}>
              See the applicable agencies for collection rules. If in doubt, do not collect.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.header}>
        {parent && <Text style={styles.parent}>{parent}</Text>}
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {formation.map_unit_symbol && (
            <View style={styles.unitTag} accessibilityLabel={`Map unit ${formation.map_unit_symbol}`}>
              <Text style={styles.unitTagText}>{formation.map_unit_symbol}</Text>
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
      </View>

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
          <SectionHead>How it formed</SectionHead>
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
        <View style={styles.sectionTight}>
          <SectionHead>Rocks nearby</SectionHead>
          {nearby.data.map((item) => {
            const rocks = plainRockTypes(item.rock_types);
            const name = shortFormationName(item.name);
            const where = `${formatDistance(item.distance_m)} ${compass(item.bearing_deg)}`;
            return (
              <Pressable
                key={item.name}
                style={({ pressed }) => [styles.nearbyRow, pressed && styles.pressed]}
                onPress={() => onSelectPoint?.({ lat: item.edge_lat, lng: item.edge_lng })}
                accessibilityRole="button"
                accessibilityLabel={`${rocks}, ${name}, ${where}`}
              >
                <LithologySwatch kind={lithologyFor(item.rock_types)} />
                <View style={styles.nearbyText}>
                  <Text style={styles.nearbyRocks} numberOfLines={1}>
                    {rocks}
                  </Text>
                  <Text style={styles.nearbyName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
                <View style={styles.nearbyWhere}>
                  <Text style={styles.nearbyDistance}>{where}</Text>
                  <BearingIcon bearing={item.bearing_deg} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 4. Example photos, captioned like book figures */}
      {images && images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {images.map((image, i) => (
            <View key={image.id} style={styles.figure}>
              <Image
                source={{ uri: image.url }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                accessibilityLabel={image.caption ?? `Example photo of ${title}`}
              />
              <Text style={styles.caption} numberOfLines={4}>
                <Text style={styles.figLabel}>FIG. {i + 1} </Text>
                {image.caption}
                {image.credit ? <Text style={styles.credit}>{` Photo: ${image.credit}.`}</Text> : null}
              </Text>
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
        <Text style={styles.expanderText}>Geologist&apos;s view</Text>
        <ChevronIcon up={expanded} />
      </Pressable>

      {expanded && (
        <View style={styles.section}>
          {ageText ? <GlossaryText style={styles.age}>{ageText}</GlossaryText> : null}
          {formation.geologic_age && (
            <GlossaryText style={styles.meta}>{`Rock class: ${formation.geologic_age}`}</GlossaryText>
          )}
          {formation.name !== title && <Text style={styles.meta}>Map name: {formation.name}</Text>}

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
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.meta}>Loading age and description…</Text>
            </View>
          )}
          {!macrostrat.isLoading && !unit && !ownDescription && (
            <Text style={styles.meta}>
              {macrostrat.error ? 'Age and description unavailable offline.' : 'No detailed description for this spot.'}
            </Text>
          )}
        </View>
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
    gap: 18,
  },
  notice: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.noticeBorder,
    borderRadius: 10,
    backgroundColor: colors.noticeBg,
    padding: 12,
  },
  noticeIcon: {
    paddingTop: 2,
  },
  noticeText: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.noticeInk,
  },
  noticeBody: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 20,
    color: colors.noticeInk,
  },
  header: {
    gap: 4,
  },
  parent: {
    fontFamily: fonts.label,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.ink,
  },
  unitTag: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  unitTagText: {
    fontFamily: fonts.labelBold,
    fontSize: 15,
    color: colors.ink,
  },
  sourceButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
  },
  sourceText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
  section: {
    gap: 10,
  },
  sectionTight: {
    gap: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionTitle: {
    ...labelStyle,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.ink,
  },
  lead: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 28,
    color: colors.ink,
  },
  aiLabel: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.muted,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  pressed: {
    backgroundColor: colors.paper,
  },
  nearbyText: {
    flex: 1,
  },
  nearbyRocks: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  nearbyName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
  },
  nearbyWhere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nearbyDistance: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  images: {
    gap: 14,
  },
  figure: {
    width: 300,
    gap: 8,
  },
  image: {
    width: 300,
    height: 200,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.rule,
  },
  caption: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
  },
  figLabel: {
    fontFamily: fonts.labelBold,
    letterSpacing: 1,
    color: colors.ink,
  },
  credit: {
    fontFamily: fonts.serifItalic,
  },
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  expanderText: {
    ...labelStyle,
    fontSize: 15,
  },
  age: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attribution: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
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
    fontSize: 13,
    color: colors.inkSoft,
  },
});

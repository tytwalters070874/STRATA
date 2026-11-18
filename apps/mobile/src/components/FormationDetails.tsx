import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFormationImages } from '../hooks/useFormationImages';
import type { Formation } from '../hooks/useFormation';

interface FormationDetailsProps {
  formation: Formation;
}

/** "Morrison Formation" details: age, rock types, description, example photos and source. */
export default function FormationDetails({ formation }: FormationDetailsProps) {
  const { data: images } = useFormationImages(formation.name);
  const ageRange =
    formation.age_ma_min != null && formation.age_ma_max != null
      ? `${formation.age_ma_min}–${formation.age_ma_max} Ma`
      : null;

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

      {(formation.geologic_age || ageRange) && (
        <Text style={styles.age}>
          {[formation.geologic_age, ageRange].filter(Boolean).join(' · ')}
        </Text>
      )}

      {formation.rock_types && formation.rock_types.length > 0 && (
        <View style={styles.chips}>
          {formation.rock_types.map((rock) => (
            <View key={rock} style={styles.chip}>
              <Text style={styles.chipText}>{rock}</Text>
            </View>
          ))}
        </View>
      )}

      {formation.description && <Text style={styles.body}>{formation.description}</Text>}

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

      {formation.source_url && (
        <Pressable
          onPress={() => Linking.openURL(formation.source_url!)}
          accessibilityRole="link"
          style={styles.sourceButton}
        >
          <Text style={styles.sourceText}>View source</Text>
        </Pressable>
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

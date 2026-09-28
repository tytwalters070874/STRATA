import { useHeaderHeight } from '@react-navigation/elements';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ConfidenceMeter from '../components/ConfidenceMeter';
import { useCatalog, useDeleteEntry, useUpdateNotes, type CatalogEntry } from '../hooks/useCatalog';
import type { RootStackScreenProps } from '../navigation/types';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function formatCoords(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export default function CatalogScreen({ navigation }: RootStackScreenProps<'Catalog'>) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { data: entries, isLoading, error, refetch, isRefetching } = useCatalog();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.centered, { padding: 24 }]}>
        <Text style={styles.emptyTitle}>Couldn't load your catalog</Text>
        <Text style={styles.emptyBody}>{error.message}</Text>
        <Pressable style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <FlatList
        data={entries ?? []}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <CatalogItem
            entry={item}
            expanded={item.id === expandedId}
            onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.centered, { paddingVertical: 64, gap: 8 }]}>
            <Text style={styles.emptyTitle}>No rocks yet</Text>
            <Text style={styles.emptyBody}>Identify a rock and save it to start your collection.</Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Camera')}>
              <Text style={styles.primaryButtonText}>Identify a rock</Text>
            </Pressable>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

interface CatalogItemProps {
  entry: CatalogEntry;
  expanded: boolean;
  onToggle: () => void;
}

function CatalogItem({ entry, expanded, onToggle }: CatalogItemProps) {
  const formation = entry.formation_guess ?? entry.formation_name;
  const coords = formatCoords(entry.lat, entry.lng);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {entry.photo_url ? (
          <Image source={{ uri: entry.photo_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.summaryText}>
          <Text style={styles.rockType} numberOfLines={1}>
            {entry.custom_label ?? entry.rock_type ?? 'Unidentified'}
          </Text>
          {formation && (
            <Text style={styles.formation} numberOfLines={1}>
              {formation}
            </Text>
          )}
          <Text style={styles.meta} numberOfLines={1}>
            {dateFormat.format(new Date(entry.saved_at))}
            {coords ? `  ·  ${coords}` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded && <CatalogDetails entry={entry} />}
    </View>
  );
}

function CatalogDetails({ entry }: { entry: CatalogEntry }) {
  const [draft, setDraft] = useState(entry.user_notes ?? '');
  const updateNotes = useUpdateNotes();
  const deleteEntry = useDeleteEntry();
  const isDirty = draft !== (entry.user_notes ?? '');

  const confirmDelete = () => {
    Alert.alert('Remove from catalog?', 'This rock will be removed from your collection.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          deleteEntry.mutate(entry, {
            onError: (e) => Alert.alert("Couldn't remove", e.message),
          }),
      },
    ]);
  };

  return (
    <View style={styles.details}>
      {entry.confidence_score != null && <ConfidenceMeter confidence={entry.confidence_score} />}

      {entry.formation_name && entry.formation_name !== entry.formation_guess && (
        <Text style={styles.detailLine}>
          Mapped here: {entry.formation_name}
          {entry.map_unit_symbol ? ` (${entry.map_unit_symbol})` : ''}
        </Text>
      )}
      {entry.geologic_age && <Text style={styles.detailLine}>Age: {entry.geologic_age}</Text>}

      <Text style={styles.notesLabel}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={draft}
        onChangeText={setDraft}
        placeholder="Outcrop, bedding, what you noticed…"
        placeholderTextColor="#a8a296"
        multiline
        textAlignVertical="top"
      />
      {updateNotes.error && <Text style={styles.error}>{updateNotes.error.message}</Text>}

      <View style={styles.detailActions}>
        <Pressable onPress={confirmDelete} disabled={deleteEntry.isPending} hitSlop={8}>
          <Text style={styles.deleteText}>Remove</Text>
        </Pressable>
        <Pressable
          style={[styles.saveNoteButton, (!isDirty || updateNotes.isPending) && styles.disabled]}
          disabled={!isDirty || updateNotes.isPending}
          onPress={() => updateNotes.mutate({ id: entry.id, notes: draft })}
        >
          {updateNotes.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {!isDirty && updateNotes.isSuccess ? 'Saved ✓' : 'Save note'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f4f0',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e3dfd7',
  },
  thumbPlaceholder: {
    borderWidth: 1,
    borderColor: '#d6d0c4',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  rockType: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1d1b16',
    textTransform: 'capitalize',
  },
  formation: {
    fontSize: 14,
    color: '#4a463e',
  },
  meta: {
    fontSize: 12,
    color: '#8a857a',
  },
  chevron: {
    fontSize: 16,
    color: '#8a857a',
  },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e1d8',
    paddingTop: 12,
  },
  detailLine: {
    fontSize: 14,
    color: '#4a463e',
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a857a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#ddd8ce',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: '#1d1b16',
    backgroundColor: '#fbfaf8',
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteText: {
    color: '#d4453a',
    fontSize: 15,
    fontWeight: '600',
  },
  saveNoteButton: {
    minWidth: 110,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#6b4f2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6b4f2a',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1b16',
  },
  emptyBody: {
    fontSize: 15,
    color: '#6b665c',
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    color: '#d4453a',
  },
});

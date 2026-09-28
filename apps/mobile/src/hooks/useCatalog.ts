import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../lib/auth';
import { ROCK_PHOTOS_BUCKET } from '../lib/identifyRock';
import { supabase } from '../lib/supabase';
import type { ConfidenceTier } from '../types/identification';

export interface CatalogEntry {
  id: string;
  identification_id: string | null;
  user_notes: string | null;
  custom_label: string | null;
  saved_at: string;
  lat: number | null;
  lng: number | null;
  photo_path: string | null;
  rock_type: string | null;
  formation_guess: string | null;
  confidence_score: number | null;
  confidence_tier: ConfidenceTier | null;
  formation_name: string | null;
  map_unit_symbol: string | null;
  geologic_age: string | null;
  /** Signed URL for the private photo, valid for SIGNED_URL_TTL_S. */
  photo_url: string | null;
}

const SIGNED_URL_TTL_S = 60 * 60;

async function fetchCatalog(): Promise<CatalogEntry[]> {
  const { data, error } = await supabase
    .from('catalog_view')
    .select('*')
    .order('saved_at', { ascending: false })
    .returns<Omit<CatalogEntry, 'photo_url'>[]>();
  if (error) throw error;

  const paths = data.map((row) => row.photo_path).filter((p): p is string => p != null);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from(ROCK_PHOTOS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    // Missing thumbnails shouldn't hide the catalog.
    if (signError) console.warn('Could not sign photo URLs', signError);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
    }
  }

  return data.map((row) => ({
    ...row,
    photo_url: row.photo_path ? urlByPath.get(row.photo_path) ?? null : null,
  }));
}

export function useCatalog() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['catalog', userId],
    queryFn: fetchCatalog,
    enabled: userId != null,
    // Refresh well before the signed photo URLs expire.
    staleTime: (SIGNED_URL_TTL_S / 2) * 1000,
  });
}

export function useUpdateNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const value = notes.trim() === '' ? null : notes;
      const { error } = await supabase.from('catalog_entries').update({ user_notes: value }).eq('id', id);
      if (error) throw error;
      return { id, notes: value };
    },
    onSuccess: ({ id, notes }) => {
      queryClient.setQueriesData<CatalogEntry[]>({ queryKey: ['catalog'] }, (entries) =>
        entries?.map((entry) => (entry.id === id ? { ...entry, user_notes: notes } : entry)),
      );
    },
  });
}

/** Soft delete: sets is_deleted so the entry drops out of catalog_view. */
export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: CatalogEntry) => {
      const { error } = await supabase.from('catalog_entries').update({ is_deleted: true }).eq('id', entry.id);
      if (error) throw error;
      return entry;
    },
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: ['catalog'] });
      const previous = queryClient.getQueriesData<CatalogEntry[]>({ queryKey: ['catalog'] });
      queryClient.setQueriesData<CatalogEntry[]>({ queryKey: ['catalog'] }, (entries) =>
        entries?.filter((e) => e.id !== entry.id),
      );
      return { previous };
    },
    onError: (_error, _entry, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSuccess: (entry) => {
      // Lets the Results screen offer "Save" again for this identification.
      queryClient.removeQueries({ queryKey: ['catalog-entry', entry.identification_id] });
    },
  });
}

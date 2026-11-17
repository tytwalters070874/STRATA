import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../lib/auth';
import { ROCK_PHOTOS_BUCKET, thumbnailPath } from '../lib/identifyRock';
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
  /**
   * Signed URL for the list thumbnail, valid for SIGNED_URL_TTL_S: the small
   * thumbnail when one exists, otherwise the full photo.
   */
  thumbnail_url: string | null;
  /**
   * Stable image-cache key (the Storage path). Signed URLs change on every
   * fetch, so caching by URL would re-download the same image each time.
   */
  thumbnail_cache_key: string | null;
}

const SIGNED_URL_TTL_S = 60 * 60;

type CatalogRow = Omit<CatalogEntry, 'thumbnail_url' | 'thumbnail_cache_key'>;

/** Signs the given paths; paths that don't exist are simply left out. */
async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>();
  if (paths.length === 0) return urlByPath;
  const { data: signed, error } = await supabase.storage
    .from(ROCK_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);
  // Missing images shouldn't hide the catalog.
  if (error) console.warn('Could not sign photo URLs', error);
  for (const item of signed ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }
  return urlByPath;
}

async function fetchCatalog(): Promise<CatalogEntry[]> {
  const { data, error } = await supabase
    .from('catalog_view')
    .select('*')
    .order('saved_at', { ascending: false })
    .returns<CatalogRow[]>();
  if (error) throw error;

  const photoPaths = data.map((row) => row.photo_path).filter((p): p is string => p != null);
  const thumbUrls = await signPaths(photoPaths.map(thumbnailPath));
  // Photos saved before thumbnails existed fall back to the full image.
  const withoutThumb = photoPaths.filter((path) => !thumbUrls.has(thumbnailPath(path)));
  const fullUrls = await signPaths(withoutThumb);

  return data.map((row) => {
    if (!row.photo_path) return { ...row, thumbnail_url: null, thumbnail_cache_key: null };
    const thumb = thumbnailPath(row.photo_path);
    const thumbUrl = thumbUrls.get(thumb);
    return thumbUrl
      ? { ...row, thumbnail_url: thumbUrl, thumbnail_cache_key: thumb }
      : {
          ...row,
          thumbnail_url: fullUrls.get(row.photo_path) ?? null,
          thumbnail_cache_key: row.photo_path,
        };
  });
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface SaveInput {
  formationId: string | null;
  lat: number;
  lng: number;
}

/**
 * Catalog state for one identification: whether it is already saved, and a
 * mutation to save it. Invalidates the 'catalog' query so the catalog list
 * picks up new entries.
 */
export function useSaveToCatalog(identificationId: string | null) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ['catalog-entry', identificationId];

  const existing = useQuery({
    queryKey,
    enabled: identificationId != null && userId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_entries')
        .select('id')
        .eq('identification_id', identificationId!)
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async ({ formationId, lat, lng }: SaveInput) => {
      if (!identificationId) throw new Error('This identification was not recorded, so it cannot be saved');
      if (!userId) throw new Error('Not signed in');

      const { data, error } = await supabase
        .from('catalog_entries')
        .insert({
          user_id: userId,
          identification_id: identificationId,
          formation_id: formationId,
          location_snapshot: `SRID=4326;POINT(${lng} ${lat})`,
        })
        .select('id')
        .single<{ id: string }>();
      if (error) throw error;
      return data;
    },
    onSuccess: (entry) => {
      queryClient.setQueryData(queryKey, entry);
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });

  return {
    isSaved: existing.data != null || save.isSuccess,
    isChecking: existing.isLoading,
    save: save.mutate,
    isSaving: save.isPending,
    error: save.error,
  };
}

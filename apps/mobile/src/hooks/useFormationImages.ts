import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';
import { supabase } from '../lib/supabase';

export interface FormationImage {
  id: string;
  url: string;
  caption: string | null;
  credit: string | null;
  license: string | null;
}

/**
 * Example photos of a formation, from the formation_images table. Empty until
 * images are curated for that formation.
 */
export function useFormationImages(formationName: string | null) {
  return useQuery({
    queryKey: ["formation-images", formationName],
    enabled: formationName != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formation_images')
        .select("id, url, caption, credit, license")
        .eq("formation_name", formationName!)
        .order('sort_order', { ascending: true })
        .returns<FormationImage[]>();
      if (error) throw error;
      return data;
    },
  });
}

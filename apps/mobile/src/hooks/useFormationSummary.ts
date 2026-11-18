import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';
import { supabase } from '../lib/supabase';

export interface FormationSummary {
  summary: string;
  how_it_formed: string | null;
  /** 'ai' until replaced by text from a definitive source. */
  source: string;
  reviewed: boolean;
}

/** The plain-language summary for a formation, or null if none is written yet. */
export function useFormationSummary(formationName: string | null) {
  return useQuery({
    queryKey: ['formation-summary', formationName],
    enabled: formationName != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formation_summaries')
        .select('summary, how_it_formed, source, reviewed')
        .eq('formation_name', formationName!)
        .maybeSingle<FormationSummary>();
      if (error) throw error;
      return data;
    },
  });
}

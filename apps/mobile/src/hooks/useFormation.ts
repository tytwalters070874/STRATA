import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';

export interface Formation {
  id: string;
  name: string;
  map_unit_symbol: string | null;
  geologic_age: string | null;
  age_ma_min: number | null;
  age_ma_max: number | null;
  rock_types: string[] | null;
  description: string | null;
  source_url: string | null;
  state: string | null;
}

// 4 decimal places is ~11 m, well under formation-polygon scale, so GPS jitter
// while standing still reuses the cached result instead of re-querying.
const COORD_PRECISION = 4;

const round = (value: number) => Number(value.toFixed(COORD_PRECISION));

async function fetchFormationAt(lat: number, lng: number): Promise<Formation | null> {
  const { data, error } = await supabase
    .rpc('get_formation_at', { lat, lng })
    .maybeSingle<Formation>();

  if (error) throw error;
  return data;
}

/**
 * Looks up the geologic formation at a GPS point.
 * `formation` is null when the point is outside MT/WY coverage.
 * Pass null coordinates to disable the query (e.g. before the first GPS fix).
 */
export function useFormation(lat: number | null | undefined, lng: number | null | undefined) {
  const hasCoords = lat != null && lng != null;
  const roundedLat = hasCoords ? round(lat) : null;
  const roundedLng = hasCoords ? round(lng) : null;

  const query = useQuery({
    queryKey: ['formation', roundedLat, roundedLng],
    queryFn: () => fetchFormationAt(roundedLat!, roundedLng!),
    enabled: hasCoords,
    // Formation boundaries don't change during a session.
    staleTime: Infinity,
    // Keep showing the last formation while the next lookup is in flight.
    placeholderData: (previous) => previous,
  });

  return {
    formation: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

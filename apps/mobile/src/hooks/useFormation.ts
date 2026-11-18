import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';
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

// Formations span hundreds of metres to kilometres, so only look up again
// after moving this far from the last lookup point. Looking up from the
// actual position (not a snapped grid) keeps results correct near contacts.
const RELOOKUP_DISTANCE_M = 50;

// ~1 m; only used to make the cache key stable.
const KEY_PRECISION = 5;

const round = (value: number) => Number(value.toFixed(KEY_PRECISION));

/** Approximate ground distance in metres; plenty accurate at 50 m scale. */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const metresPerDegree = 111_320;
  const dLat = (bLat - aLat) * metresPerDegree;
  const dLng = (bLng - aLng) * metresPerDegree * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

interface Point {
  lat: number;
  lng: number;
}

export async function fetchFormationAt(lat: number, lng: number): Promise<Formation | null> {
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

  // The point the current lookup was made from. Moves only once the user is
  // RELOOKUP_DISTANCE_M away, so walking doesn't trigger a request every few
  // metres. (Updating state during render is React's pattern for deriving
  // state from changing props.)
  const [anchor, setAnchor] = useState<Point | null>(null);
  if (hasCoords && (!anchor || distanceM(anchor.lat, anchor.lng, lat, lng) > RELOOKUP_DISTANCE_M)) {
    setAnchor({ lat: round(lat), lng: round(lng) });
  }

  const query = useQuery({
    queryKey: ['formation', anchor?.lat ?? null, anchor?.lng ?? null],
    queryFn: () => fetchFormationAt(anchor!.lat, anchor!.lng),
    enabled: anchor != null,
    // Formation boundaries don't change; keep results for offline use.
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    // Keep showing the last formation while the next lookup is in flight.
    placeholderData: (previous) => previous,
  });

  return {
    /** The point the current lookup was made from (moves every RELOOKUP_DISTANCE_M). */
    point: anchor,
    formation: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

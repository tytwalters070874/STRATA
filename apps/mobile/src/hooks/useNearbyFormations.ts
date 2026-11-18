import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';
import { supabase } from '../lib/supabase';

export interface NearbyFormation {
  name: string;
  map_unit_symbol: string | null;
  rock_types: string[] | null;
  distance_m: number;
  bearing_deg: number;
  edge_lat: number;
  edge_lng: number;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** 47.3 → "NE". */
export function compass(bearingDeg: number): string {
  return COMPASS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8];
}

/** 1234 → "1.2 km", 340 → "340 m". */
export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres / 10) * 10} m`;
}

/** Formations within 5 km of a point, nearest first (PRD 3.1 nearby discovery). */
export function useNearbyFormations(point: { lat: number; lng: number } | null) {
  const lat = point == null ? null : Number(point.lat.toFixed(4));
  const lng = point == null ? null : Number(point.lng.toFixed(4));

  return useQuery({
    queryKey: ['nearby', lat, lng],
    enabled: lat != null && lng != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_nearby_formations', { lat: lat!, lng: lng! });
      if (error) throw error;
      return (data ?? []) as NearbyFormation[];
    },
  });
}

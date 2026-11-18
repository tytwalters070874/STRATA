import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';
import { fetchFormationAt } from './useFormation';

/**
 * The formation under any chosen map point (a tap), independent of the GPS
 * position. Results are keyed by the point rounded to ~1 m and kept for offline
 * use, like the GPS lookup. Pass null to disable.
 */
export function useFormationAt(point: { lat: number; lng: number } | null) {
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;

  const query = useQuery({
    queryKey: ['formation-at', lat == null ? null : Number(lat.toFixed(5)), lng == null ? null : Number(lng.toFixed(5))],
    queryFn: () => fetchFormationAt(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
  });

  return {
    formation: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

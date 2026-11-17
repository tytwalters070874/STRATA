import { useIsFocused } from '@react-navigation/native';
import { useContext, useEffect, useId } from 'react';

import { LocationContext, type LocationMode } from '../lib/location';

export type { PermissionState } from '../lib/location';

/**
 * The device position, from the app's shared GPS subscription. GPS only runs
 * while the calling screen is focused, so screens left mounted underneath
 * (the map, behind the camera) don't keep it on.
 */
export function useCurrentPosition(mode: LocationMode) {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useCurrentPosition must be used inside <LocationProvider>');
  const { permission, position, positionIsFresh, gpsError, setDemand } = context;

  const id = useId();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    setDemand(id, mode);
    return () => setDemand(id, null);
  }, [id, isFocused, mode, setDemand]);

  return { permission, position, positionIsFresh, gpsError };
}

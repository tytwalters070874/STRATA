import * as Location from 'expo-location';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

export type PermissionState = 'pending' | 'granted' | 'denied';

/**
 * How closely a screen needs to follow the user.
 * - map: the formation sheet. Re-checks every ~25 m, so updates can be sparse.
 * - capture: the camera, where the photo is tagged with the exact spot.
 *
 * Both use high accuracy: lower-accuracy modes fall back to Wi-Fi/cell
 * positioning, which is off by ~100 m or more in the backcountry, too coarse
 * near formation contacts. Battery is saved by updating less often and by
 * stopping GPS whenever no visible screen needs it.
 */
export type LocationMode = 'map' | 'capture';

const WATCH_OPTIONS: Record<LocationMode, Location.LocationOptions> = {
  map: { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 25 },
  capture: { accuracy: Location.Accuracy.High, timeInterval: 2_000, distanceInterval: 5 },
};

interface LocationContextValue {
  permission: PermissionState;
  position: Location.LocationObject | null;
  /** Registers (or with null, removes) one screen's need for location. */
  setDemand: (id: string, mode: LocationMode | null) => void;
}

export const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Owns the app's single GPS subscription. Screens declare what they need
 * with useCurrentPosition; GPS runs at the most demanding mode any focused
 * screen asks for, and stops when none does or the app is in the background.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [demands, setDemands] = useState<Record<string, LocationMode>>({});
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const setDemand = useCallback((id: string, mode: LocationMode | null) => {
    setDemands((current) => {
      if (mode === null) {
        if (!(id in current)) return current;
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      return current[id] === mode ? current : { ...current, [id]: mode };
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  const modes = Object.values(demands);
  const wanted: LocationMode | null = !appActive
    ? null
    : modes.includes('capture')
      ? 'capture'
      : modes.length > 0
        ? 'map'
        : null;

  // Ask for permission the first time any screen needs location.
  const needsPermission = wanted !== null && permission === 'pending';
  useEffect(() => {
    if (!needsPermission) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!cancelled) setPermission(status === 'granted' ? 'granted' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [needsPermission]);

  // After "Open settings", pick up a permission granted there on return.
  const recheckDenied = appActive && permission === 'denied';
  useEffect(() => {
    if (!recheckDenied) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!cancelled && status === 'granted') setPermission('granted');
    })();
    return () => {
      cancelled = true;
    };
  }, [recheckDenied]);

  // The one GPS subscription, restarted only when the needed mode changes.
  useEffect(() => {
    if (permission !== 'granted' || wanted === null) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      // Show something immediately while waiting for a fresh fix.
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!cancelled && lastKnown) setPosition((current) => current ?? lastKnown);

      const sub = await Location.watchPositionAsync(WATCH_OPTIONS[wanted], (next) => setPosition(next));
      if (cancelled) sub.remove();
      else subscription = sub;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [permission, wanted]);

  const value = useMemo(() => ({ permission, position, setDemand }), [permission, position, setDemand]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

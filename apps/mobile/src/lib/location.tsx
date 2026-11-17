import * as Location from 'expo-location';
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  // Whether Google's "Location Accuracy" prompt has been offered this launch.
  // Android shows it when GPS starts and that setting is off. The prompt
  // backgrounds the app, which stops GPS; restarting GPS would show it again,
  // looping for anyone who declines. So it is offered once per launch only.
  const accuracyPromptOfferedRef = useRef(false);
  // The app is on screen when this first renders. AppState.currentState can
  // still read 'background' here: Android reports the state from before the
  // activity resumed, and the correction can arrive before the listener
  // below subscribes. Later changes come through the listener.
  const [appActive, setAppActive] = useState(true);

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
  //
  // Deliberately independent of appActive, and the answer is never
  // discarded: the permission dialog is a separate system screen, so opening
  // it moves STRATA to the background. When this effect depended on
  // appActive, that cleanup cancelled the request, the dialog closed, the app
  // became active again and asked again, in a loop that never stored the
  // answer. A permission result is true for the whole app, so it is always
  // kept, even if the screens that asked have since gone.
  const needsPermission = modes.length > 0 && permission === 'pending';
  useEffect(() => {
    if (!needsPermission) return;
    void Location.requestForegroundPermissionsAsync().then(({ status }) =>
      setPermission(status === 'granted' ? 'granted' : 'denied'),
    );
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

      const mayShowUserSettingsDialog = !accuracyPromptOfferedRef.current;
      accuracyPromptOfferedRef.current = true;
      const sub = await Location.watchPositionAsync(
        { ...WATCH_OPTIONS[wanted], mayShowUserSettingsDialog },
        (next) => setPosition(next),
      );
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

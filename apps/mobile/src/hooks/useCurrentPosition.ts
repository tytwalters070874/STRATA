import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type PermissionState = 'pending' | 'granted' | 'denied';

/** Requests foreground location permission and tracks the device position while mounted. */
export function useCurrentPosition() {
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [position, setPosition] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');

      // Show something immediately while waiting for a fresh fix.
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!cancelled && lastKnown) setPosition(lastKnown);

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
        (next) => setPosition(next),
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { permission, position };
}

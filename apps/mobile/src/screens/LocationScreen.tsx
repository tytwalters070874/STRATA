import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentPosition, type PermissionState } from '../hooks/useCurrentPosition';
import { useFormation, type Formation } from '../hooks/useFormation';
import type { RootStackScreenProps } from '../navigation/types';

// Roughly the center of MT/WY, shown until the first GPS fix arrives.
const INITIAL_REGION = {
  latitude: 45.0,
  longitude: -108.5,
  latitudeDelta: 8,
  longitudeDelta: 8,
};
const FIX_ZOOM_DELTA = 0.05;

export default function LocationScreen({ navigation }: RootStackScreenProps<'Map'>) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const hasCenteredRef = useRef(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  // react-native-maps (Android, new architecture) applies a changed
  // mapPadding straight to the native GoogleMap, which is null until the map
  // has loaded, and crashes the app. The sheet is measured before that, so
  // padding and camera moves wait for onMapReady.
  const [mapReady, setMapReady] = useState(false);

  const { permission, position } = useCurrentPosition('map');
  const lat = position?.coords.latitude;
  const lng = position?.coords.longitude;
  const { formation, isLoading, error } = useFormation(lat, lng);

  const recenter = () => {
    if (!mapReady || lat == null || lng == null) return;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: FIX_ZOOM_DELTA, longitudeDelta: FIX_ZOOM_DELTA },
      500,
    );
  };

  // Zoom to the user once, on the first fix after the map is ready; after
  // that they can pan freely.
  useEffect(() => {
    if (mapReady && !hasCenteredRef.current && lat != null && lng != null) {
      hasCenteredRef.current = true;
      recenter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, lat, lng]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        mapType="terrain"
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        mapPadding={mapReady ? { top: insets.top, right: 0, bottom: sheetHeight, left: 0 } : undefined}
        onMapReady={() => setMapReady(true)}
      />

      {position && (
        <Pressable
          onPress={recenter}
          style={[styles.recenterButton, { bottom: sheetHeight + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => navigation.navigate('Catalog')}
        style={[styles.catalogButton, { top: insets.top + 12 }]}
        accessibilityRole="button"
        accessibilityLabel="My catalog"
      >
        <Text style={styles.catalogButtonText}>Catalog</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Camera')}
        style={[styles.cameraButton, { bottom: sheetHeight + 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Identify a rock"
      >
        <Text style={styles.cameraButtonText}>Identify rock</Text>
      </Pressable>

      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.handle} />
        <SheetContent
          permission={permission}
          hasFix={position != null}
          accuracyM={position?.coords.accuracy ?? null}
          formation={formation}
          isLoading={isLoading}
          error={error}
        />
      </View>
    </View>
  );
}

interface SheetContentProps {
  permission: PermissionState;
  hasFix: boolean;
  accuracyM: number | null;
  formation: Formation | null;
  isLoading: boolean;
  error: Error | null;
}

function SheetContent({ permission, hasFix, accuracyM, formation, isLoading, error }: SheetContentProps) {
  if (permission === 'denied') {
    return (
      <>
        <Text style={styles.title}>Location access needed</Text>
        <Text style={styles.body}>
          STRATA uses your location to identify the formation beneath you.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={styles.button}>
          <Text style={styles.buttonText}>Open settings</Text>
        </Pressable>
      </>
    );
  }

  if (!hasFix || (isLoading && !formation)) {
    return (
      <View style={styles.row}>
        <ActivityIndicator />
        <Text style={styles.body}>{hasFix ? 'Looking up formation…' : 'Getting GPS fix…'}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <>
        <Text style={styles.title}>Couldn't load formation</Text>
        <Text style={styles.body}>{error.message}</Text>
      </>
    );
  }

  if (!formation) {
    return (
      <>
        <Text style={styles.title}>No formation data here</Text>
        <Text style={styles.body}>STRATA currently covers Montana and Wyoming.</Text>
      </>
    );
  }

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {formation.name}
        </Text>
        {formation.map_unit_symbol && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formation.map_unit_symbol}</Text>
          </View>
        )}
      </View>

      {formation.geologic_age && <Text style={styles.age}>{formation.geologic_age}</Text>}

      {formation.rock_types && formation.rock_types.length > 0 && (
        <View style={styles.chips}>
          {formation.rock_types.map((rock) => (
            <View key={rock} style={styles.chip}>
              <Text style={styles.chipText}>{rock}</Text>
            </View>
          ))}
        </View>
      )}

      {accuracyM != null && (
        <Text style={styles.meta}>GPS accuracy ±{Math.round(accuracyM)} m</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d0d0d0',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1b16',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#efe6d8',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b4f2a',
  },
  age: {
    fontSize: 15,
    color: '#4a463e',
  },
  body: {
    fontSize: 15,
    color: '#4a463e',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f2f0ec',
  },
  chipText: {
    fontSize: 13,
    color: '#3a372f',
  },
  meta: {
    fontSize: 12,
    color: '#8a857a',
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6b4f2a',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  catalogButton: {
    position: 'absolute',
    right: 16,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  catalogButtonText: {
    color: '#6b4f2a',
    fontSize: 15,
    fontWeight: '600',
  },
  cameraButton: {
    position: 'absolute',
    left: 16,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#6b4f2a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recenterIcon: {
    fontSize: 22,
    color: '#1a73e8',
  },
});

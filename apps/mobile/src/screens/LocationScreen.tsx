import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FormationDetails from '../components/FormationDetails';
import { BookIcon, CameraIcon, HelpIcon, LayersIcon, LocateIcon } from '../components/Icons';
import { useAuth } from '../lib/auth';
import { useTour } from '../lib/tour';
import { colors, fonts } from '../theme';
import { useCurrentPosition, type PermissionState } from '../hooks/useCurrentPosition';
import { useFormation, type Formation } from '../hooks/useFormation';
import { useFormationAt } from '../hooks/useFormationAt';
import type { RootStackScreenProps } from '../navigation/types';

// Roughly the center of MT/WY, shown until the first GPS fix arrives.
const INITIAL_REGION = {
  latitude: 45.0,
  longitude: -108.5,
  latitudeDelta: 8,
  longitudeDelta: 8,
};
// Street-level enough to see nearby contacts. Set as a zoom level rather than
// a region span: on Android a span is fitted to the map's padded size, and
// right after onMapReady that fit could leave the map zoomed out.
const FIX_ZOOM = 13;
// The floating buttons above the sheet: 12 gap + 44 button + 8 clearance.
// Included in the map's bottom padding so Google's logo, which must stay
// visible, sits above them instead of underneath.
const BUTTON_ROW_HEIGHT = 64;
// Macrostrat's geologic map tiles (512 px, CC BY 4.0).
const GEOLOGY_TILES = 'https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png';

function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

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
  // The first zoom waits longer, for onMapLoaded (tiles drawn). Applying the
  // padding above can cancel a camera move already in progress, and the
  // padding goes on right after onMapReady, so a zoom started then was lost.
  const [mapLoaded, setMapLoaded] = useState(false);

  const { isSignedIn, leaveGuestMode } = useAuth();
  const { permission, position, gpsError } = useCurrentPosition('map');
  const lat = position?.coords.latitude;
  const lng = position?.coords.longitude;
  const { formation, point: formationPoint, isLoading, error } = useFormation(lat, lng);

  // A point the user tapped on the map. When set, the sheet shows the formation
  // under that point instead of the one under the GPS fix.
  const [tapped, setTapped] = useState<{ lat: number; lng: number } | null>(null);
  const tappedFormation = useFormationAt(tapped);

  const recenter = () => {
    if (!mapReady || lat == null || lng == null) return;
    mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom: FIX_ZOOM }, { duration: 500 });
  };

  // The location button returns both the map and the sheet to the user's own
  // position. Recentring alone left the sheet on a tapped point, which looked
  // like the button did nothing.
  const goToMyLocation = () => {
    setTapped(null);
    recenter();
  };

  // A nearby formation was chosen in the sheet: select that point and move
  // the map to it, as if the user had tapped it.
  const selectPoint = (point: { lat: number; lng: number }) => {
    setTapped(point);
    if (mapReady) {
      mapRef.current?.animateCamera(
        { center: { latitude: point.lat, longitude: point.lng }, zoom: FIX_ZOOM },
        { duration: 500 },
      );
    }
  };

  const { show: showTour } = useTour();
  // Macrostrat's geologic map colours over the base map (PRD 3.1 overlay).
  const [showGeology, setShowGeology] = useState(true);

  // Zoom to the user once, on the first fix after the map has loaded; after
  // that they can pan freely.
  useEffect(() => {
    if (mapLoaded && !hasCenteredRef.current && lat != null && lng != null) {
      hasCenteredRef.current = true;
      recenter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, lat, lng]);

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
        mapPadding={
          mapReady
            ? { top: insets.top, right: 0, bottom: sheetHeight + BUTTON_ROW_HEIGHT, left: 0 }
            : undefined
        }
        onMapReady={() => setMapReady(true)}
        onMapLoaded={() => setMapLoaded(true)}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setTapped({ lat: latitude, lng: longitude });
        }}
      >
        {showGeology && (
          <UrlTile
            urlTemplate={GEOLOGY_TILES}
            tileSize={512}
            maximumZ={16}
            opacity={0.45}
            zIndex={1}
          />
        )}
      </MapView>

      {/* Keeps map labels from running under the clock and status icons. */}
      <View pointerEvents="none" style={[styles.statusBarScrim, { height: insets.top }]} />

      <View style={[styles.mapTools, { top: insets.top + 12 }]}>
        <Pressable
          onPress={showTour}
          style={styles.toolButton}
          accessibilityRole="button"
          accessibilityLabel="How STRATA works"
        >
          <HelpIcon />
        </Pressable>
        <Pressable
          onPress={() => setShowGeology((v) => !v)}
          style={[styles.toolButton, showGeology && styles.toolButtonOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: showGeology }}
          accessibilityLabel="Geologic map colours"
        >
          <LayersIcon color={showGeology ? '#fff' : colors.ink} />
        </Pressable>
        {showGeology && <Text style={styles.mapCredit}>Geologic map: Macrostrat (CC BY 4.0)</Text>}
      </View>

      {position && (
        <Pressable
          onPress={goToMyLocation}
          style={[styles.recenterButton, { bottom: sheetHeight + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          <LocateIcon />
        </Pressable>
      )}

      {isSignedIn ? (
        <>
          <Pressable
            onPress={() => navigation.navigate('Catalog')}
            style={[styles.catalogButton, { top: insets.top + 12 }]}
            accessibilityRole="button"
            accessibilityLabel="My catalog"
          >
            <BookIcon size={18} />
            <Text style={styles.catalogButtonText}>Catalog</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Camera')}
            style={[styles.cameraButton, { bottom: sheetHeight + 12 }]}
            accessibilityRole="button"
            accessibilityLabel="Identify a rock"
          >
            <CameraIcon size={20} />
            <Text style={styles.cameraButtonText}>Identify rock</Text>
          </Pressable>
        </>
      ) : (
        // Guests see the map only. Signing in returns to the landing page.
        <Pressable
          onPress={leaveGuestMode}
          style={[styles.catalogButton, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Sign in for catalog and rock identification"
        >
          <Text style={styles.catalogButtonText}>Sign in</Text>
        </Pressable>
      )}

      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.handle} />
        {tapped ? (
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
            <View style={styles.tappedHeader}>
              <Text style={styles.meta}>
                {formatCoords(tapped.lat, tapped.lng)}
              </Text>
              <Pressable onPress={() => setTapped(null)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.linkText}>Use my location</Text>
              </Pressable>
            </View>
            {tappedFormation.isLoading ? (
              <View style={styles.row}>
                <ActivityIndicator />
                <Text style={styles.body}>Looking up formation…</Text>
              </View>
            ) : tappedFormation.error ? (
              <>
                <Text style={styles.title}>Couldn't load formation</Text>
                <Text style={styles.body}>{tappedFormation.error.message}</Text>
              </>
            ) : tappedFormation.formation ? (
              <FormationDetails formation={tappedFormation.formation} point={tapped} onSelectPoint={selectPoint} />
            ) : (
              <>
                <Text style={styles.title}>No formation data here</Text>
                <Text style={styles.body}>STRATA currently covers Montana and Wyoming.</Text>
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
            <SheetContent
              permission={permission}
              gpsError={gpsError}
              hasFix={position != null}
              accuracyM={position?.coords.accuracy ?? null}
              formation={formation}
              point={formationPoint}
              onSelectPoint={selectPoint}
              isLoading={isLoading}
              error={error}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

interface SheetContentProps {
  permission: PermissionState;
  gpsError: string | null;
  hasFix: boolean;
  accuracyM: number | null;
  formation: Formation | null;
  /** The point the GPS formation was looked up at. */
  point: { lat: number; lng: number } | null;
  onSelectPoint: (point: { lat: number; lng: number }) => void;
  isLoading: boolean;
  error: Error | null;
}

function SheetContent({
  permission,
  gpsError,
  hasFix,
  accuracyM,
  formation,
  point,
  onSelectPoint,
  isLoading,
  error,
}: SheetContentProps) {
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

  if (!hasFix && gpsError) {
    return (
      <>
        <Text style={styles.title}>GPS unavailable</Text>
        <Text style={styles.body}>Turn on location services, then reopen STRATA.</Text>
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
      {point ? (
        <FormationDetails formation={formation} point={point} onSelectPoint={onSelectPoint} />
      ) : null}
      {accuracyM != null && (
        <Text style={styles.meta}>GPS accuracy ±{Math.round(accuracyM)} m</Text>
      )}
    </>
  );
}

// Map controls are drawn like a field notebook: paper fill, a thin ink
// outline, no drop shadows.
const control = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.ink,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapTools: {
    position: 'absolute',
    left: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  toolButton: {
    ...control,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  toolButtonOn: {
    backgroundColor: colors.accent,
  },
  mapCredit: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: 'rgba(251,248,241,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(244,239,228,0.8)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c9bfae',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  // A fixed height, not a maximum: when the sheet grew as details and photos
  // loaded, the buttons above it jumped (taps landed on the map instead), and
  // each change re-applied the map padding, which cancels a camera move in
  // progress.
  sheetScroll: {
    height: 320,
  },
  sheetScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  tappedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.serifSemiBold,
    fontSize: 22,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 23,
    color: colors.inkSoft,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  buttonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  recenterButton: {
    ...control,
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  catalogButton: {
    ...control,
    position: 'absolute',
    right: 16,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 6,
  },
  catalogButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  cameraButton: {
    position: 'absolute',
    left: 16,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
});

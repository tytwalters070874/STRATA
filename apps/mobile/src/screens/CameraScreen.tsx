import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { useAuth } from '../lib/auth';
import { identifyRock, type IdentifyStage } from '../lib/identifyRock';
import { CloseIcon } from '../components/Icons';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, fonts, labelStyle } from '../theme';

const TIPS = [
  { title: 'Fill the frame', body: 'Get close so the rock fills the guide box.' },
  { title: 'Fresh surface', body: 'A broken face shows true color and grain better than a weathered one.' },
  { title: 'Even daylight', body: 'Avoid harsh shadows and flash glare.' },
  { title: 'Add scale', body: 'A coin, pencil or rock hammer beside it helps judge grain size.' },
];

const STAGE_LABEL: Record<IdentifyStage, string> = {
  preparing: 'Preparing photo…',
  uploading: 'Uploading…',
  identifying: 'Identifying rock…',
};

type CaptureState =
  | { status: 'idle' }
  | { status: 'working'; stage: IdentifyStage; previewUri: string }
  | { status: 'error'; message: string; previewUri: string | null };

export default function CameraScreen({ navigation }: RootStackScreenProps<'Camera'>) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { permission: locationPermission, position, positionIsFresh, gpsError } = useCurrentPosition('capture');
  const { session, isLoading: authLoading, error: authError, retry: retryAuth } = useAuth();

  const [cameraReady, setCameraReady] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [capture, setCapture] = useState<CaptureState>({ status: 'idle' });

  if (!cameraPermission) {
    return <View style={styles.fill} />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.permissionScreen, styles.centered, { padding: 24 }]}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          STRATA uses the camera to photograph rocks for identification.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            cameraPermission.canAskAgain ? requestCameraPermission() : Linking.openSettings()
          }
        >
          <Text style={styles.primaryButtonText}>
            {cameraPermission.canAskAgain ? 'Allow camera' : 'Open settings'}
          </Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }}>
          <Text style={styles.linkText}>Back to map</Text>
        </Pressable>
      </View>
    );
  }

  const blocker = (() => {
    if (authLoading) return 'Connecting…';
    if (!session) return authError ? 'Offline — tap to retry sign-in' : 'Connecting…';
    if (locationPermission === 'denied') return 'Location is needed to identify rocks';
    if (gpsError) return 'GPS unavailable. Check location services.';
    // A cached fix from an earlier session is not used to tag the photo.
    if (!position || !positionIsFresh) return 'Waiting for GPS…';
    if (!cameraReady) return 'Starting camera…';
    return null;
  })();

  const isWorking = capture.status === 'working';
  const canCapture = blocker === null && !isWorking;

  const takePhoto = async () => {
    if (!canCapture || !cameraRef.current || !session || !position) return;
    setShowTips(false);

    let previewUri: string | null = null;
    try {
      // exif: false only omits EXIF from the JS result; the file is
      // re-encoded without metadata in identifyRock.
      const picture = await cameraRef.current.takePictureAsync({ quality: 1, exif: false });
      previewUri = picture.uri;
      setCapture({ status: 'working', stage: 'preparing', previewUri });

      const { latitude: lat, longitude: lng } = position.coords;
      const { result, photoUri } = await identifyRock({
        photo: picture,
        userId: session.user.id,
        lat,
        lng,
        accuracyM: position.coords.accuracy,
        onStage: (stage) => setCapture({ status: 'working', stage, previewUri: previewUri! }),
      });

      setCapture({ status: 'idle' });
      navigation.navigate('Results', { result, photoUri, lat, lng });
    } catch (e) {
      setCapture({
        status: 'error',
        message: e instanceof Error ? e.message : 'Something went wrong',
        previewUri,
      });
    }
  };

  const previewUri = capture.status === 'idle' ? null : capture.previewUri;

  return (
    <View style={styles.fill}>
      {/* Unmount when not focused so the camera is released while on Results. */}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="on"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => setCapture({ status: 'error', message: e.message, previewUri: null })}
        />
      )}

      {previewUri && <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} />}

      {/* Framing guide, hidden under the tips so its outline doesn't show through */}
      {!previewUri && !showTips && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centered]}>
          <View style={styles.frame} />
        </View>
      )}

      {showTips && !previewUri && (
        <View style={[styles.tipsCard, { top: insets.top + 64 }]}>
          <Text style={styles.tipsHeading}>For the best identification</Text>
          {TIPS.map((tip) => (
            <View key={tip.title} style={styles.tipRow}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          ))}
          <Pressable onPress={() => setShowTips(false)} style={styles.tipsDismiss}>
            <Text style={styles.linkText}>Got it</Text>
          </Pressable>
        </View>
      )}

      {/* Working / error overlay */}
      {capture.status === 'working' && (
        <View style={[StyleSheet.absoluteFill, styles.centered, styles.scrim]}>
          <ActivityIndicator size="large" color={colors.card} />
          <Text style={styles.stageText}>{STAGE_LABEL[capture.stage]}</Text>
        </View>
      )}

      {capture.status === 'error' && (
        <View style={[StyleSheet.absoluteFill, styles.centered, styles.scrim, { padding: 24 }]}>
          <Text style={styles.errorTitle}>Couldn't identify this photo</Text>
          <Text style={styles.errorBody}>{capture.message}</Text>
          <Pressable style={styles.primaryButton} onPress={() => setCapture({ status: 'idle' })}>
            <Text style={styles.primaryButtonText}>Retake</Text>
          </Pressable>
        </View>
      )}

      {/* Top bar, drawn after the full-screen overlays so ✕ still works on the
          error screen. While working, the buttons are disabled instead. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          disabled={isWorking}
        >
          <CloseIcon />
        </Pressable>
        <GpsChip accuracyM={position?.coords.accuracy ?? null} />
        <Pressable
          onPress={() => setShowTips((v) => !v)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Photo tips"
          disabled={isWorking}
        >
          <Text style={styles.iconText}>?</Text>
        </Pressable>
      </View>

      {/* Bottom controls */}
      {capture.status === 'idle' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {blocker && (
            <Pressable onPress={!session && authError ? retryAuth : undefined}>
              <Text style={styles.blockerText}>{blocker}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={takePhoto}
            disabled={!canCapture}
            style={[styles.shutter, !canCapture && styles.shutterDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function GpsChip({ accuracyM }: { accuracyM: number | null }) {
  const label = accuracyM == null ? 'No GPS' : `GPS ±${Math.round(accuracyM)} m`;
  const color = accuracyM == null ? colors.danger : accuracyM <= 25 ? '#2e7d4f' : '#b8860b';
  return (
    <View style={styles.chip}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '78%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  // The viewfinder stays dark so the photo reads true; controls and cards
  // are the same paper and ink as the rest of the app.
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: fonts.serifSemiBold,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 26,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
    fontSize: 13,
  },
  tipsCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ink,
    gap: 12,
  },
  tipsHeading: {
    ...labelStyle,
  },
  tipRow: {
    gap: 2,
  },
  tipTitle: {
    fontFamily: fonts.serifSemiBold,
    color: colors.ink,
    fontSize: 16,
  },
  tipBody: {
    fontFamily: fonts.serif,
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 21,
  },
  tipsDismiss: {
    alignSelf: 'flex-end',
    paddingTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
    fontSize: 16,
  },
  scrim: {
    backgroundColor: 'rgba(30,27,22,0.8)',
    gap: 12,
  },
  stageText: {
    fontFamily: fonts.serif,
    color: colors.card,
    fontSize: 18,
  },
  errorTitle: {
    fontFamily: fonts.serifSemiBold,
    color: colors.card,
    fontSize: 22,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fonts.serif,
    color: colors.paper,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
  },
  blockerText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
    fontSize: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  // The permission screen is a page of the app, not a viewfinder.
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  permissionTitle: {
    fontFamily: fonts.serifSemiBold,
    color: colors.ink,
    fontSize: 26,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    fontFamily: fonts.serif,
    color: colors.inkSoft,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    color: '#fff',
    fontSize: 16,
  },
});

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json with plugins that need secrets from .env / EAS env vars.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'STRATA uses your location to show the geologic formation you are standing on.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'STRATA uses the camera to photograph rocks for identification.',
        recordAudioAndroid: false,
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
});

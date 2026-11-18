import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/lib/auth';
import { LocationProvider } from './src/lib/location';
import { persistOptions, queryClient } from './src/lib/queryClient';
import { TourProvider } from './src/lib/tour';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <TourProvider>
            <LocationProvider>
              <RootNavigator />
              <StatusBar style="auto" />
            </LocationProvider>
          </TourProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { useTour } from '../lib/tour';
import AccountScreen from '../screens/AccountScreen';
import CameraScreen from '../screens/CameraScreen';
import CatalogScreen from '../screens/CatalogScreen';
import LandingScreen from '../screens/LandingScreen';
import LocationScreen from '../screens/LocationScreen';
import ResultsScreen from '../screens/ResultsScreen';
import TourScreen from '../screens/TourScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Gate: a person who has neither signed in nor chosen guest mode sees the
 * landing page. Guests get the map only; identifying rocks, the catalog and
 * the account screens are registered only for a signed-in account.
 */
export default function RootNavigator() {
  const { isLoading, isSignedIn, guestMode } = useAuth();
  const { seen: tourSeen } = useTour();

  if (isLoading) return <View style={styles.blank} />;
  if (!isSignedIn && !guestMode) return <LandingScreen />;
  // The tour comes after the landing choice, once; the map's help button reopens it.
  if (tourSeen === null) return <View style={styles.blank} />;
  if (!tourSeen) return <TourScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Map">
        <Stack.Screen name="Map" component={LocationScreen} options={{ headerShown: false }} />
        {isSignedIn && (
          <>
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Identification' }} />
            <Stack.Screen
              name="Catalog"
              component={CatalogScreen}
              options={({ navigation }) => ({
                title: 'My catalog',
                headerRight: () => (
                  <Pressable
                    onPress={() => navigation.navigate('Account')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Account"
                  >
                    <Text style={styles.headerLink}>Account</Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: '#f6f4f0',
  },
  headerLink: {
    color: '#6b4f2a',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { useTour } from '../lib/tour';
import { colors, fonts } from '../theme';
import AccountScreen from '../screens/AccountScreen';
import CameraScreen from '../screens/CameraScreen';
import CatalogScreen from '../screens/CatalogScreen';
import LandingScreen from '../screens/LandingScreen';
import LocationScreen from '../screens/LocationScreen';
import ResultsScreen from '../screens/ResultsScreen';
import TourScreen from '../screens/TourScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Headers sit on the same paper as the screens, titled in the reading serif.
const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: colors.paper },
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.serifSemiBold, fontSize: 20 },
  contentStyle: { backgroundColor: colors.paper },
} as const;

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
      <Stack.Navigator initialRouteName="Map" screenOptions={SCREEN_OPTIONS}>
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
    backgroundColor: colors.paper,
  },
  headerLink: {
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
    fontSize: 16,
  },
});

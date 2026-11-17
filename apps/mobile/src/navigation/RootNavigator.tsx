import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text } from 'react-native';

import AccountScreen from '../screens/AccountScreen';
import CameraScreen from '../screens/CameraScreen';
import CatalogScreen from '../screens/CatalogScreen';
import LocationScreen from '../screens/LocationScreen';
import ResultsScreen from '../screens/ResultsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Map">
        <Stack.Screen name="Map" component={LocationScreen} options={{ headerShown: false }} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerLink: {
    color: '#6b4f2a',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
        <Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'My catalog' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

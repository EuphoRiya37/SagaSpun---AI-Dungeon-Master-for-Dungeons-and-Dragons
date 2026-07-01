import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import AuthScreen           from './screens/AuthScreen';
import DashboardScreen      from './screens/DashboardScreen';
import CharacterCreatorScreen from './screens/CharacterCreatorScreen';
import CampaignSetupScreen  from './screens/CampaignSetupScreen';
import GameplayScreen       from './screens/GameplayScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading,   setLoading]   = useState(true);
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('token')
      .then(token => { setAuthToken(token); setLoading(false); })
      .catch(()    => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: '#0D0D0D' },
          headerTintColor:  '#E8D5B0',
          headerTitleStyle: { fontWeight: 'bold', letterSpacing: 1 },
          contentStyle:     { backgroundColor: '#0D0D0D' },
          animation:        'slide_from_right',
        }}
        initialRouteName={authToken ? 'Dashboard' : 'Auth'}
      >
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: '⚔  SAGA SPUN', headerBackVisible: false }}
        />
        <Stack.Screen
          name="CharacterCreator"
          component={CharacterCreatorScreen}
          options={{ title: '✦  Character Creator' }}
        />
        <Stack.Screen
          name="CampaignSetup"
          component={CampaignSetupScreen}
          options={{ title: '🗺  New Campaign' }}
        />
        <Stack.Screen
          name="Gameplay"
          component={GameplayScreen}
          options={({ route }) => ({ title: route.params?.campaignName || 'Campaign' })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WaterQualityFormScreen } from '../screens/water-quality/WaterQualityFormScreen';
import { OutboxScreen } from '../screens/OutboxScreen';
import { BiometricFormScreen } from '../screens/biometrics/BiometricFormScreen';
import { FeedingFormScreen } from '../screens/feeding/FeedingFormScreen';
import { MortalityFormScreen } from '../screens/mortality/MortalityFormScreen';

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  WaterQualityForm: { pondId?: string } | undefined;
  BiometricForm: { cycleId?: string } | undefined;
  FeedingForm: { pondId?: string } | undefined;
  MortalityForm: { pondId?: string } | undefined;
  Outbox: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigatorInner() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <AppStack.Screen name="Home" component={HomeScreen} options={{ title: 'Aquafort' }} />
      <AppStack.Screen
        name="WaterQualityForm"
        component={WaterQualityFormScreen}
        options={{ title: 'Registrar Coleta' }}
      />
      <AppStack.Screen
        name="BiometricForm"
        component={BiometricFormScreen}
        options={{ title: 'Nova Biometria' }}
      />
      <AppStack.Screen
        name="FeedingForm"
        component={FeedingFormScreen}
        options={{ title: 'Registrar Trato' }}
      />
      <AppStack.Screen
        name="MortalityForm"
        component={MortalityFormScreen}
        options={{ title: 'Registrar Mortalidade' }}
      />
      <AppStack.Screen
        name="Outbox"
        component={OutboxScreen}
        options={{ title: 'Fila de Sincronização' }}
      />
    </AppStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#0ea5e9" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigatorInner /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useFarm, type UseFarmReturn } from '../hooks/useFarm';
import { FarmSwitcher } from '../components/FarmSwitcher';
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

function AppNavigatorInner({ farm }: { farm: UseFarmReturn }) {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0f172a' },
        headerRight: () => (
          <FarmSwitcher
            farms={farm.farms}
            activeFarm={farm.activeFarm}
            isLoading={farm.isLoading}
            isSwitching={farm.isSwitching}
            onSwitch={farm.switchFarm}
          />
        ),
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

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#0ea5e9" size="large" />
    </View>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const farm = useFarm(isAuthenticated);

  if (authLoading) {
    return <LoadingScreen />;
  }

  /**
   * Gate de carregamento (item 5 do plano): sem isso, as telas de domínio
   * (Home, formulários) montam e disparam chamadas de API antes de
   * `/me/farms` resolver e do X-Farm-Id existir no SecureStore — o backend
   * responde 403, e como a maioria das telas só trata `isLoading` local,
   * isso vira um estado vazio enganoso em vez de um erro visível. Foi um
   * achado bloqueante numa revisão anterior desta mesma feature no
   * aquafort-web (AppLayout.tsx lá ganhou o mesmo gate).
   */
  if (isAuthenticated && farm.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigatorInner farm={farm} /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

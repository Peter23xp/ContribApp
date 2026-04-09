/**
 * AppNavigator.tsx
 *
 * Architecture :
 *   NavigationContainer
 *   └── RootStack  (createNativeStackNavigator, headerShown: false)
 *       ├── Main  → AppTabNavigator   (tabs normaux)
 *       ├── PaymentConfirm → PaymentConfirmationScreen (SCR-011)  — gestureEnabled: false
 *       ├── Receipt        → PaymentReceiptScreen      (SCR-012)
 *       ├── MemberProfile  → MemberProfileScreen       (futur)
 *       └── Historique     → HistoryScreen             (futur)
 *
 * Les écrans du stack "modal" s'affichent par-dessus les tabs sans
 * que la BottomTabBar soit visible.
 */
import React, { useEffect } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import { useAuthStore }   from '../stores/authStore';
import { Colors }         from '../constants/colors';

// ── Navigateurs ──
import AuthNavigator       from './AuthNavigator';
import AppTabNavigator     from './AppTabNavigator';

// ── Écrans "overlay" accessibles par dessus les tabs ──
import PaymentConfirmationScreen from '../screens/payment/PaymentConfirmationScreen';
import PaymentReceiptScreen      from '../screens/payment/PaymentReceiptScreen';

// ── Stubs écrans futurs (évitent une erreur de navigation) ──
const FutureScreen = () => <View style={{ flex: 1, backgroundColor: Colors.surface }} />;

// ─── Types du stack racine ────────────────────────────────────

export type RootStackParamList = {
  Main:           undefined;
  PaymentConfirm: { txId: string };
  Receipt:        { txId: string; receiptData?: any };
  MemberProfile:  { memberId: string };
  Historique:     undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Thème de navigation ──────────────────────────────────────

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background:  Colors.surface,
    card:        Colors.surface,
    border:      'transparent',
    primary:     Colors.primary,
    text:        Colors.onSurface,
    notification: Colors.error,
  },
};

// ─── Navigator principal ──────────────────────────────────────

export default function AppNavigator() {
  const { isAuthenticated, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      {isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {/* Tabs principales */}
          <Stack.Screen
            name="Main"
            component={AppTabNavigator}
            options={{ gestureEnabled: false }}
          />

          {/* SCR-011 — Confirmation de paiement (no-back gesture) */}
          <Stack.Screen
            name="PaymentConfirm"
            component={PaymentConfirmationScreen}
            options={{
              gestureEnabled: false,        // pas de swipe-back
              animation: 'fade_from_bottom',
            }}
          />

          {/* SCR-012 — Reçu de paiement */}
          <Stack.Screen
            name="Receipt"
            component={PaymentReceiptScreen}
            options={{ animation: 'slide_from_right' }}
          />

          {/* Écrans futurs (stubs pour éviter les erreurs de navigation) */}
          <Stack.Screen name="MemberProfile" component={FutureScreen} />
          <Stack.Screen name="Historique"    component={FutureScreen} />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

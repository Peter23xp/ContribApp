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
import React from 'react';
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

// ── Écrans Groupe (Module 04) ──
import GroupConfigScreen      from '../screens/group/GroupConfigScreen';
import MemberManagementScreen from '../screens/group/MemberManagementScreen';
import InviteMembersScreen    from '../screens/group/InviteMembersScreen';
import GroupDetailsScreen     from '../screens/group/GroupDetailsScreen';
import FullHistoryScreen      from '../screens/history/FullHistoryScreen';
import MyHistoryScreen        from '../screens/history/MyHistoryScreen';
import ChangePINScreen        from '../screens/profile/ChangePINScreen';

// ── Stubs écrans futurs (évitent une erreur de navigation) ──
const FutureScreen = () => <View style={{ flex: 1, backgroundColor: Colors.surface }} />;

function HistoryEntry(props: any) {
  const role = useAuthStore((s) => s.role);
  if (role === 'member') return <MyHistoryScreen {...props} />;
  return <FullHistoryScreen {...props} />;
}

// ─── Types du stack racine ────────────────────────────────────

export type RootStackParamList = {
  Main:             undefined;
  PaymentConfirm:   { txId: string };
  Receipt:          { txId: string; receiptData?: any };
  // Module 04
  GroupConfig:      { groupId?: string };
  MemberManagement: undefined;
  Invitations:      undefined;
  GroupDetails:     undefined;
  ChangePIN:        undefined;
  // Stubs futurs
  MemberProfile:    { memberId: string };
  Historique:       { presetMonth?: string; presetStatus?: 'PAYE' | 'EN_RETARD' | 'EN_ATTENTE' | 'ECHEC'; presetMemberId?: string } | undefined;
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
  const { isAuthenticated, isLoading } = useAuthStore();

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

          {/* ─── Module 04 : Gestion du Groupe ─── */}
          <Stack.Screen
            name="GroupConfig"
            component={GroupConfigScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="MemberManagement"
            component={MemberManagementScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Invitations"
            component={InviteMembersScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="GroupDetails"
            component={GroupDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ChangePIN"
            component={ChangePINScreen}
            options={{ animation: 'slide_from_right' }}
          />

          {/* Stubs futurs */}
          <Stack.Screen name="MemberProfile" component={FutureScreen} />
          <Stack.Screen name="Historique"    component={HistoryEntry} />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

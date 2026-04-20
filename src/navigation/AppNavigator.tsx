/**
 * AppNavigator.tsx
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

// ── Écrans Onboarding ──
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import GroupCreationScreen from '../screens/onboarding/GroupCreationScreen';
import GroupReadyScreen from '../screens/onboarding/GroupReadyScreen';
import InviteHubScreen from '../screens/onboarding/InviteHubScreen';

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
  // Onboarding
  Welcome: undefined;
  GroupCreation: undefined;
  GroupReady: { groupId: string; inviteCode: string };
  InviteHub: { groupId?: string; inviteCode?: string };

  // Main
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
  const { isAuthenticated, isLoading, role, groupId } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Handle initialization logical screen
  const needsOnboarding = isAuthenticated && role === 'admin' && !groupId;
  const initScreen = needsOnboarding ? 'Welcome' : 'Main';

  return (
    <NavigationContainer theme={NavTheme}>
      {isAuthenticated ? (
        <Stack.Navigator 
          initialRouteName={initScreen} 
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          {/* Onboarding spécifiques */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="GroupCreation" component={GroupCreationScreen} />
          <Stack.Screen name="GroupReady" component={GroupReadyScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="InviteHub" component={InviteHubScreen} />

          {/* Tabs principales */}
          <Stack.Screen
            name="Main"
            component={AppTabNavigator}
            options={{ gestureEnabled: false }}
          />

          {/* SCR-011 — Confirmation de paiement */}
          <Stack.Screen
            name="PaymentConfirm"
            component={PaymentConfirmationScreen}
            options={{
              gestureEnabled: false,
              animation: 'fade_from_bottom',
            }}
          />

          {/* SCR-012 — Reçu de paiement */}
          <Stack.Screen
            name="Receipt"
            component={PaymentReceiptScreen}
          />

          {/* ─── Module 04 : Gestion du Groupe ─── */}
          <Stack.Screen name="GroupConfig" component={GroupConfigScreen} />
          <Stack.Screen name="MemberManagement" component={MemberManagementScreen} />
          <Stack.Screen name="Invitations" component={InviteMembersScreen} />
          <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
          <Stack.Screen name="ChangePIN" component={ChangePINScreen} />

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

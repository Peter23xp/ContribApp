import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { Colors, Fonts, Radius } from '../constants/colors';

import AdminDashboardScreen from '../screens/dashboard/AdminDashboardScreen';
import TreasurerDashboardScreen from '../screens/dashboard/TreasurerDashboardScreen';
import MemberDashboardScreen from '../screens/dashboard/MemberDashboardScreen';
import PayContributionScreen         from '../screens/payment/PayContributionScreen';
import AdminPaymentTrackingScreen    from '../screens/payment/AdminPaymentTrackingScreen';
import TreasurerPaymentsScreen       from '../screens/payment/TreasurerPaymentsScreen';
import GroupDetailsScreen            from '../screens/group/GroupDetailsScreen';
import ProfileScreen                 from '../screens/profile/ProfileScreen';
import * as db from '../services/database';

const Tab = createBottomTabNavigator();

// ─── Placeholder "Pas de Groupe" ──────────────────────────────────────────────
function NoGroupPlaceholder({ navigation, title }: { navigation: any; title: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.surface }}>
      <MaterialCommunityIcons name="account-group-outline" size={72} color={Colors.outlineVariant} style={{ marginBottom: 16 }} />
      <Text style={{ fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface, textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
        Vous devez intégrer un groupe pour accéder à cet écran. Rendez-vous sur la page d'accueil pour en rejoindre un.
      </Text>
      <TouchableOpacity 
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: Radius.lg }}
        onPress={() => navigation.navigate('Accueil')}
      >
        <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
        <Text style={{ fontFamily: Fonts.headline, fontSize: 15, color: '#FFF' }}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeDashboard({ navigation, route }: any) {
  const role = useAuthStore(s => s.role);
  if (role === 'admin')     return <AdminDashboardScreen navigation={navigation} route={route} />;
  if (role === 'treasurer') return <TreasurerDashboardScreen navigation={navigation} route={route} />;
  return <MemberDashboardScreen navigation={navigation} route={route} />;
}

/** Tab "Contributions" : SCR-008 Admin | SCR-009 Trésorière | SCR-010 Membre */
function ContributionsTab(props: any) {
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (role !== 'member' || !user) { setHasGroup(true); return; }
    db.getGroupForMember(user.id).then(g => setHasGroup(!!g));
  }, [user, role]);

  if (role === 'admin')     return <AdminPaymentTrackingScreen {...props} />;
  if (role === 'treasurer') return <TreasurerPaymentsScreen {...props} />;
  
  if (hasGroup === null) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}><ActivityIndicator color={Colors.primary} /></View>;
  if (!hasGroup) return <NoGroupPlaceholder navigation={props.navigation} title="Paiements inaccessibles" />;
  
  return <PayContributionScreen {...props} />;
}

/** Tab "Groupe" */
function GroupTab(props: any) {
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  useEffect(() => {
    if (role !== 'member' || !user) { setHasGroup(true); return; }
    db.getGroupForMember(user.id).then(g => setHasGroup(!!g));
  }, [user, role]);

  if (hasGroup === null) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}><ActivityIndicator color={Colors.primary} /></View>;
  if (!hasGroup) return <NoGroupPlaceholder navigation={props.navigation} title="Aucun groupe" />;
  
  return <GroupDetailsScreen {...props} />;
}

// ─── Tab items config ──────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Accueil',  label: 'Dashboard',      icon: 'view-grid',          iconActive: 'view-grid'        },
  { name: 'Payer',    label: 'Contributions',  icon: 'cash-multiple',      iconActive: 'cash-multiple'    },
  { name: 'Groupe',   label: 'Members',        icon: 'account-group-outline', iconActive: 'account-group' },
  { name: 'Profil',   label: 'Profil',         icon: 'account-circle-outline',  iconActive: 'account-circle' },
] as const;

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const item = TAB_ITEMS[index];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never);
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
          >
            <MaterialCommunityIcons
              name={isFocused ? item.iconActive : item.icon}
              size={22}
              color={isFocused ? Colors.primary : '#64748b'}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Navigator ────────────────────────────────────────────────────────────────
export default function AppTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Accueil"  component={HomeDashboard}      />
      <Tab.Screen name="Payer"    component={ContributionsTab}    />
      <Tab.Screen name="Groupe"   component={GroupTab}   />
      <Tab.Screen name="Profil"   component={ProfileScreen}        />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    backgroundColor: 'rgba(243,250,255,0.92)',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    shadowColor: '#071e27',
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.xl,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: Colors.surfaceContainer,
  },
  tabLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: Colors.primary,
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { Colors, Fonts, Radius } from '../constants/colors';

import AdminDashboardScreen from '../screens/dashboard/AdminDashboardScreen';
import TreasurerDashboardScreen from '../screens/dashboard/TreasurerDashboardScreen';
import MemberDashboardScreen from '../screens/dashboard/MemberDashboardScreen';
import { SubmitContributionScreen }   from '../screens/payment/SubmitContributionScreen';
import { ApprovalQueueScreen }        from '../screens/payment/ApprovalQueueScreen';
import AdminPaymentTrackingScreen    from '../screens/payment/AdminPaymentTrackingScreen';
import GroupDetailsScreen            from '../screens/group/GroupDetailsScreen';
import ProfileScreen                 from '../screens/profile/ProfileScreen';
import * as db from '../services/database';

const Tab = createBottomTabNavigator();

// ─── Placeholder "Pas de Groupe" ──────────────────────────────────────────────
function NoGroupPlaceholder({ navigation, title }: { navigation: any; title: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.surface }}>
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: Colors.goldMuted,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
      }}>
        <MaterialCommunityIcons name="account-group-outline" size={36} color={Colors.primary} />
      </View>
      <Text style={{ fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 32, lineHeight: 21 }}>
        Vous devez intégrer un groupe pour accéder à cet écran. Rendez-vous sur la page d'accueil pour en rejoindre un.
      </Text>
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24,
          borderRadius: Radius.xl,
        }}
        onPress={() => navigation.navigate('Accueil')}
      >
        <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
        <Text style={{ fontFamily: Fonts.headline, fontSize: 15, color: '#FFF' }}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Bannière "Mode Membre Actif" ────────────────────────────────────────────
function MemberModeBanner() {
  const { role, activeRole, restoreRole } = useAuthStore();
  if (activeRole !== 'member' || role === 'member') return null;
  const label = role === 'admin' ? 'Administrateur' : 'Trésorière';
  return (
    <View style={styles.memberBanner}>
      <Ionicons name="swap-horizontal" size={14} color="#FFF" />
      <Text style={styles.memberBannerText}>Mode membre actif</Text>
      <TouchableOpacity onPress={restoreRole} style={styles.memberBannerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.memberBannerBtnText}>Retour {label}</Text>
        <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function HomeDashboard({ navigation, route }: any) {
  const activeRole = useAuthStore(s => s.activeRole);
  if (activeRole === 'admin')     return <AdminDashboardScreen navigation={navigation} route={route} />;
  if (activeRole === 'treasurer') return <TreasurerDashboardScreen navigation={navigation} route={route} />;
  return <MemberDashboardScreen navigation={navigation} route={route} />;
}

/** Tab "Contributions" : SCR-008 Admin | SCR-009-B Trésorière (ApprovalQueue) | SCR-010-B Membre (SubmitContribution) */
function ContributionsTab(props: any) {
  const activeRole = useAuthStore(s => s.activeRole);
  const user = useAuthStore(s => s.user);
  const uid = useAuthStore(s => s.uid);
  const groupId = useAuthStore(s => s.groupId);
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  const refreshMembership = React.useCallback(() => {
    if (activeRole !== 'member' || !user) {
      setHasGroup(true);
      return;
    }

    if (groupId) {
      setHasGroup(true);
      return;
    }

    db.getGroupForMember(uid || '').then(g => setHasGroup(!!g));
  }, [groupId, activeRole, user, uid]);

  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  useFocusEffect(
    React.useCallback(() => {
      refreshMembership();
    }, [refreshMembership])
  );

  if (activeRole === 'admin')     return <AdminPaymentTrackingScreen {...props} />;
  if (activeRole === 'treasurer') return <ApprovalQueueScreen {...props} />;

  if (hasGroup === null) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}><ActivityIndicator color={Colors.primary} /></View>;
  if (!hasGroup) return <NoGroupPlaceholder navigation={props.navigation} title="Paiements inaccessibles" />;

  return <SubmitContributionScreen {...props} />;
}

/** Tab "Groupe" */
function GroupTab(props: any) {
  const activeRole = useAuthStore(s => s.activeRole);
  const user = useAuthStore(s => s.user);
  const uid = useAuthStore(s => s.uid);
  const groupId = useAuthStore(s => s.groupId);
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  const refreshMembership = React.useCallback(() => {
    if (activeRole !== 'member' || !user) {
      setHasGroup(true);
      return;
    }

    if (groupId) {
      setHasGroup(true);
      return;
    }

    db.getGroupForMember(uid || '').then(g => setHasGroup(!!g));
  }, [groupId, activeRole, user, uid]);

  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  useFocusEffect(
    React.useCallback(() => {
      refreshMembership();
    }, [refreshMembership])
  );

  if (hasGroup === null) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}><ActivityIndicator color={Colors.primary} /></View>;
  if (!hasGroup) return <NoGroupPlaceholder navigation={props.navigation} title="Aucun groupe" />;

  return <GroupDetailsScreen {...props} />;
}

// ─── Tab items config ──────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Accueil',  label: 'Accueil',      icon: 'view-grid-outline',     iconActive: 'view-grid'        },
  { name: 'Payer',    label: 'Cotisations',  icon: 'cash-multiple',         iconActive: 'cash-multiple'    },
  { name: 'Groupe',   label: 'Membres',      icon: 'account-group-outline', iconActive: 'account-group'    },
  { name: 'Profil',   label: 'Profil',       icon: 'account-circle-outline', iconActive: 'account-circle'  },
] as const;

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      <View style={styles.tabBarInner}>
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
              activeOpacity={0.75}
              style={[styles.tabItem]}
            >
              <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
                <MaterialCommunityIcons
                  name={isFocused ? item.iconActive : item.icon}
                  size={22}
                  color={isFocused ? Colors.primary : Colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {isFocused && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Navigator ────────────────────────────────────────────────────────────────
export default function AppTabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <MemberModeBanner />
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Accueil"  component={HomeDashboard}      />
        <Tab.Screen name="Payer"    component={ContributionsTab}    />
        <Tab.Screen name="Groupe"   component={GroupTab}   />
        <Tab.Screen name="Profil"   component={ProfileScreen}        />
      </Tab.Navigator>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  memberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
  },
  memberBannerText: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 12,
    color: '#FFF',
    letterSpacing: 0.3,
  },
  memberBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  memberBannerBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 11,
    color: Colors.primary,
  },

  // Tab bar — warm parchment float
  tabBar: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 0,
  },
  tabBarInner: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#3D2410',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '50',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    position: 'relative',
  },
  tabIconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconWrapActive: {
    backgroundColor: Colors.goldMuted,
  },
  tabLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: Fonts.title,
  },
  tabActiveDot: {
    position: 'absolute',
    top: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
});

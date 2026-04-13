/**
 * SCR-016 — Détails du Groupe
 * GroupDetailsScreen.tsx
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Platform, Animated, Image, FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OPERATORS } from '../../constants/operators';
import { GroupInfoRow } from '../../components/common/GroupInfoRow';
import { MemberCard } from '../../components/common/MemberCard';
import { AppButton } from '../../components/common/AppButton';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import {
  fetchGroupConfig, fetchGroupMembers, fetchInviteCode,
  type GroupConfig, type GroupMember, type InviteCode
} from '../../services/groupService';
import { useAuthStore } from '../../stores/authStore';

// ─── Composants Locaux ────────────────────────────────────────

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}
function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 800, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={bs.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[bs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={bs.handle} />
        <View style={bs.header}>
          <Text style={bs.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={bs.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

function SkeletonBlock() {
  return (
    <View style={sk.card}>
      <View style={[sk.line, { width: '40%' }]} />
      <View style={[sk.line, { width: '70%' }]} />
      <View style={[sk.line, { width: '50%' }]} />
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────
export default function GroupDetailsScreen({ navigation, route }: any) {
  const user = useAuthStore(state => state.user);
  const role = useAuthStore(state => state.role);
  const isPaid = true; // Fallback ou logique depuis Zustand
  
  const groupId = "todo-use-actual-id"; // fallback to store

  const [config, setConfig] = useState<GroupConfig | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [showAllMembersModal, setShowAllMembersModal] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [conf, mems] = await Promise.all([
        fetchGroupConfig(groupId),
        fetchGroupMembers(groupId),
      ]);
      setConfig(conf);
      setMembers(mems);

      if (role === 'admin') {
        fetchInviteCode(groupId).then(setInviteCode).catch(() => {});
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les données du groupe.' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [groupId, role]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Helpers ──
  const adminEditParams = { groupId }; // params pour la route config modifier
  
  const maskedPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    return role === 'admin' ? phone : `+243 *** *** ${phone.slice(-3)}`;
  };

  const getInitials = (name?: string) => {
    if (!name) return 'GP';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0,2).toUpperCase();
  };

  // ── Renders Composants ──
  const activeMembersCount = members.filter(m => m.status === 'active').length;
  const membersPreview = members.slice(0, 5);

  const goEdit = () => {
    if (role === 'admin') navigation.navigate('GroupConfig', adminEditParams);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* 🏙️ TOP BAR STANDARD (Skill UI) */}
      <View style={s.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          )}
          <Text style={s.topBarTitle} numberOfLines={1}>{config?.name || 'Groupe'}</Text>
        </View>
        {role === 'admin' && (
          <TouchableOpacity onPress={goEdit} style={s.editBtnIcon}>
             <MaterialCommunityIcons name="pencil" size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        {/* 🏙️ EN-TÊTE DÉTAILS VISUELS */}
        <View style={s.heroCard}>
          <View style={s.heroPhotoWrap}>
            {config?.photoUrl ? (
              <Image source={{ uri: config.photoUrl }} style={s.heroPhoto} />
            ) : (
              <View style={[s.heroPhoto, { backgroundColor: Colors.surfaceContainerHigh }]}>
                <Text style={s.heroInitials}>{getInitials(config?.name)}</Text>
              </View>
            )}
          </View>
          <View style={s.heroMeta}>
            <Text style={s.heroTitle}>{config?.name || '...'}</Text>
            {config?.description && <Text style={s.heroDesc} numberOfLines={2}>{config.description}</Text>}
          </View>
        </View>

        {isOffline && <OfflineBanner />}

        <View style={{ marginTop: 8 }}>
          {/* ════ INFORMATIONS GÉNÉRALES ════ */}
          <Text style={s.sectionTitle}>Informations générales</Text>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.card}>
              <GroupInfoRow icon="account-group" label="Nom du groupe" value={config?.name ?? ''} onEditPress={role === 'admin' ? goEdit : undefined} />
              <GroupInfoRow icon="text" label="Description" value={config?.description ?? 'Aucune description'} onEditPress={role === 'admin' ? goEdit : undefined} />
              <GroupInfoRow icon="account-multiple-check" label="Membres actifs" value={`${activeMembersCount} / ${members.length} total`} />
              <GroupInfoRow icon="calendar" label="Date de création" value="Mars 2026" />
              {role === 'admin' && inviteCode && (
                <GroupInfoRow icon="ticket-percent" label="Code d'invitation" value={inviteCode.code} />
              )}
            </View>
          )}

          {/* ════ PARAMÈTRES FINANCIERS ════ */}
          <Text style={s.sectionTitle}>Paramètres financiers</Text>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.card}>
              <GroupInfoRow icon="cash-multiple" label="Montant mensuel" value={`${config?.monthlyAmount} ${config?.currency}`} />
              <GroupInfoRow icon="calendar-check" label="Jour d'échéance" value={`Le ${config?.dueDay} de chaque mois`} />
              <GroupInfoRow 
                icon="alert-circle-outline" 
                label="Pénalité de retard" 
                value={config?.penaltyAmount ? `${config.penaltyAmount} ${config.currency}` : 'Aucune pénalité'} 
              />
              <GroupInfoRow 
                icon="eye-outline" 
                label="Contributions visibles" 
                value={config?.paymentsVisible ? 'Oui (par tous)' : 'Non (Admin/Tréso uniquement)'} 
              />
              <GroupInfoRow 
                icon="shield-check" 
                label="Approbation manuelle" 
                value={config?.requireApproval ? 'Activée' : 'Désactivée'} 
              />
            </View>
          )}

          {/* ════ TRÉSORIÈRE ════ */}
          <Text style={s.sectionTitle}>Trésorière</Text>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.card}>
              <View style={s.treasurerRow}>
                <View style={s.treasurerAvatar}><Text style={s.treasurerAvatarTxt}>{config?.treasurerName.charAt(0) ?? 'T'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.treasurerName}>{config?.treasurerName ?? 'Non définie'}</Text>
                  <Text style={s.treasurerPhone}>{maskedPhone(config?.treasurerPhone ?? '')}</Text>
                  {config?.treasurerOperator && (
                    <View style={s.operatorBadge}>
                      <Text style={s.operatorBadgeText}>{config.treasurerOperator.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                {role === 'admin' && (
                  <TouchableOpacity onPress={goEdit} style={s.treasurerEditBtn}>
                    <Text style={s.treasurerEditTxt}>Modifier</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ════ MEMBRES (Aperçu) ════ */}
          <Text style={s.sectionTitle}>Membres ({activeMembersCount} actifs)</Text>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.card}>
              {membersPreview.map((m, idx) => (
                <View key={m.id} style={{ borderBottomWidth: idx < membersPreview.length - 1 ? StyleSheet.hairlineWidth : 0, borderColor: Colors.outlineVariant + '40' }}>
                  <MemberCard member={m as any} showSwipeActions={false} onActionPress={() => {}} />
                </View>
              ))}
              
              {members.length > 5 && (
                <TouchableOpacity 
                  style={s.seeAllMembersBtn} 
                  onPress={() => role === 'admin' ? navigation.navigate('MemberManagement') : setShowAllMembersModal(true)}
                >
                  <Text style={s.seeAllMembersText}>Voir les {members.length} membres</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ════ ACTIONS EN BAS SELON RÔLE ════ */}
      <View style={s.bottomActions}>
         {role === 'admin' && (
           <>
             <AppButton title="Gérer les membres" onPress={() => navigation.navigate('MemberManagement')} />
             <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
               <AppButton title="Inviter" onPress={() => navigation.navigate('Invitations')} variant="outline" style={{ flex: 1 }} />
               <AppButton title="Modifier" onPress={goEdit} variant="outline" style={{ flex: 1 }} />
             </View>
           </>
         )}

         {role === 'treasurer' && (
           <AppButton title="Voir les paiements reçus" onPress={() => navigation.navigate('Payer')} />
         )}

         {role === 'member' && (
           <>
             {isPaid ? (
               <AppButton title="Contribution payée ce mois ✓" onPress={() => {}} disabled />
             ) : (
               <AppButton title="Payer ma contribution" onPress={() => navigation.navigate('Payer')} />
             )}
             <AppButton title="Mon historique" onPress={() => navigation.navigate('Historique')} variant="outline" style={{ marginTop: 12 }} />
           </>
         )}
      </View>

      {/* BOTTOM SHEET MODAL (Membres pour Trésorière / Membre) */}
      <BottomSheet visible={showAllMembersModal} title="Tous les membres" onClose={() => setShowAllMembersModal(false)}>
         <FlatList
           data={members}
           keyExtractor={i => i.id}
           style={{ maxHeight: Platform.OS === 'ios' ? 500 : 400 }}
           showsVerticalScrollIndicator={false}
           renderItem={({ item }) => {
             const hidePaymentBadge = role === 'member' && !config?.paymentsVisible;
             return (
               <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.outlineVariant + '30', paddingHorizontal: 16 }}>
                 <MemberCard 
                   member={{ ...item, paymentStatus: hidePaymentBadge ? null : item.paymentStatus } as any} 
                   showSwipeActions={false} 
                   onActionPress={() => {}} 
                 />
               </View>
             );
           }}
         />
      </BottomSheet>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // TopBar Standard design
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 12,
    ...Shadow.card, elevation: 2, zIndex: 10,
  },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.primary },
  editBtnIcon: { padding: 8, backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.full },

  // Hero Card Profile
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.outlineVariant + '26',
    ...Shadow.card,
  },
  heroPhotoWrap: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: Colors.surface, overflow: 'hidden',
  },
  heroPhoto: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroInitials: { fontFamily: Fonts.headline, fontSize: 24, color: Colors.primary },
  heroMeta: { flex: 1, gap: 4 },
  heroTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  heroDesc: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 18 },

  sectionTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface, marginLeft: 4, marginBottom: 8, marginTop: 12 },
  
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, marginBottom: 12, ...Shadow.card, overflow: 'hidden' },

  seeAllMembersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.outlineVariant + '40' },
  seeAllMembersText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.primary },

  treasurerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  treasurerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center' },
  treasurerAvatarTxt: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.primary },
  treasurerName: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.onSurface },
  treasurerPhone: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  operatorBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.surfaceContainerLow, marginTop: 4 },
  operatorBadgeText: { fontFamily: Fonts.label, fontSize: 10, color: Colors.onSurfaceVariant },
  treasurerEditBtn: { padding: 8, alignSelf: 'flex-start' },
  treasurerEditTxt: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },

  bottomActions: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: Colors.surface,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.outlineVariant + '40',
    ...Shadow.card,
  },
});

const sk = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 20, gap: 14, marginBottom: 16, ...Shadow.card },
  line: { height: 12, backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.sm },
});

const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,30,39,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : 24, zIndex: 100 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.outlineVariant, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '50' },
  title: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  closeBtn: { padding: 4 },
});

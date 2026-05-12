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
import * as db from '../../services/database';

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
  const uid = useAuthStore(state => state.uid);
  const role = useAuthStore(state => state.role);
  const isPaid = true; // Fallback ou logique depuis Zustand

  const [groupId, setGroupId] = useState<string | undefined>(route?.params?.groupId);

  useEffect(() => {
    if (groupId || !uid) return;
    (async () => {
      const g = role === 'admin'
        ? await db.getGroupForAdmin(uid)
        : await db.getGroupForMember(uid);
      if (g) setGroupId(g.id);
    })();
  }, [uid, role, groupId]);

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
    if (!groupId) {
      setIsLoading(false);
      return;
    }
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

  const adminEditParams = { groupId };

  const maskedPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    return role === 'admin' ? phone : `+243 *** *** ${phone.slice(-3)}`;
  };

  const getInitials = (name?: string) => {
    if (!name) return 'GP';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0,2).toUpperCase();
  };

  const activeMembersCount = members.filter(m => m.status === 'active').length;
  const membersPreview = members.slice(0, 5);

  const goEdit = () => {
    if (role === 'admin') navigation.navigate('GroupConfig', adminEditParams);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Hero Header (Primary Banner) ── */}
      <View style={s.heroBanner}>
        <View style={s.heroBannerTop}>
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {role === 'admin' && (
            <TouchableOpacity onPress={goEdit} style={s.editBtn}>
              <MaterialCommunityIcons name="pencil" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={s.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.heroContent}>
          <View style={s.heroAvatarWrap}>
            {config?.photoUrl ? (
              <Image source={{ uri: config.photoUrl }} style={s.heroAvatar} />
            ) : (
              <View style={s.heroAvatarFallback}>
                <Text style={s.heroAvatarInitials}>{getInitials(config?.name)}</Text>
              </View>
            )}
          </View>
          <View style={s.heroMeta}>
            <Text style={s.heroEyebrow}>Groupe de cotisation</Text>
            <Text style={s.heroTitle} numberOfLines={1}>{config?.name || '...'}</Text>
            {config?.description ? (
              <Text style={s.heroDesc} numberOfLines={2}>{config.description}</Text>
            ) : null}
          </View>
        </View>

        {/* Stats Row inside Banner */}
        <View style={s.heroStats}>
          <View style={s.heroStatCell}>
            <Text style={s.heroStatValue}>{activeMembersCount}</Text>
            <Text style={s.heroStatLabel}>Membres actifs</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStatCell}>
            <Text style={s.heroStatValue}>{config?.monthlyAmount?.toLocaleString('fr-FR') ?? '—'}</Text>
            <Text style={s.heroStatLabel}>Montant CDF</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStatCell}>
            <Text style={s.heroStatValue}>{config?.dueDay ?? '—'}</Text>
            <Text style={s.heroStatLabel}>Jour d'échéance</Text>
          </View>
        </View>
      </View>

      {isOffline && <OfflineBanner />}

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        {/* ════ INFORMATIONS GÉNÉRALES ════ */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={s.sectionAccent} />
            <Text style={s.sectionTitle}>Informations générales</Text>
          </View>
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
        </View>

        {/* ════ PARAMÈTRES FINANCIERS ════ */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionAccent, { backgroundColor: Colors.gold }]} />
            <Text style={s.sectionTitle}>Paramètres financiers</Text>
          </View>
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
        </View>

        {/* ════ TRÉSORIÈRE ════ */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionAccent, { backgroundColor: Colors.info }]} />
            <Text style={s.sectionTitle}>Trésorière</Text>
          </View>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.treasurerCard}>
              <View style={s.treasurerTop}>
                <View style={s.treasurerAvatar}>
                  <Text style={s.treasurerAvatarTxt}>{config?.treasurerName.charAt(0) ?? 'T'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.treasurerName}>{config?.treasurerName ?? 'Non définie'}</Text>
                  <Text style={s.treasurerPhone}>{maskedPhone(config?.treasurerPhone ?? '')}</Text>
                </View>
                {role === 'admin' && (
                  <TouchableOpacity onPress={goEdit} style={s.treasurerEditBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.primary} />
                    <Text style={s.treasurerEditTxt}>Modifier</Text>
                  </TouchableOpacity>
                )}
              </View>
              {config?.treasurerOperator ? (
                <View style={s.treasurerFooter}>
                  <View style={s.operatorPill}>
                    <MaterialCommunityIcons name="phone" size={13} color={Colors.primary} />
                    <Text style={s.operatorPillText}>{config.treasurerOperator.toUpperCase()}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* ════ MEMBRES (Aperçu) ════ */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionAccent, { backgroundColor: Colors.statusPaid }]} />
            <Text style={s.sectionTitle}>Membres</Text>
            <View style={s.memberCountBadge}>
              <Text style={s.memberCountText}>{activeMembersCount} actifs</Text>
            </View>
          </View>
          {isLoading ? <SkeletonBlock /> : (
            <View style={s.card}>
              {membersPreview.map((m, idx) => (
                <View key={m.uid} style={{ borderBottomWidth: idx < membersPreview.length - 1 ? StyleSheet.hairlineWidth : 0, borderColor: Colors.outlineVariant + '40' }}>
                  <MemberCard
                    member={{
                      id: m.uid,
                      fullName: m.full_name || m.phone || 'Membre',
                      phone: m.phone ?? '',
                      role: (m.role as any) ?? 'member',
                      status: (m.status as any) ?? 'active',
                      paymentStatus: (m.paymentStatus as any) ?? null,
                      joinedAt: m.joined_at
                        ? (typeof m.joined_at?.toDate === 'function'
                            ? m.joined_at.toDate().toISOString()
                            : String(m.joined_at))
                        : new Date().toISOString(),
                    } as any}
                    showSwipeActions={false}
                    onActionPress={() => {}}
                  />
                </View>
              ))}

              {members.length > 5 && (
                <TouchableOpacity
                  style={s.seeAllBtn}
                  onPress={() => role === 'admin' ? navigation.navigate('MemberManagement') : setShowAllMembersModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.seeAllBtnText}>Voir les {members.length} membres</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Bottom spacing for actions bar */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ════ ACTIONS EN BAS SELON RÔLE ════ */}
      <View style={s.bottomActions}>
         {role === 'admin' && (
           <View style={s.actionsInner}>
             <AppButton title="Gérer les membres" onPress={() => navigation.navigate('MemberManagement')} />
             <View style={s.actionsSecondRow}>
               <AppButton title="Inviter" onPress={() => navigation.navigate('Invitations')} variant="outline" style={{ flex: 1 }} />
               <AppButton title="Modifier le groupe" onPress={goEdit} variant="outline" style={{ flex: 1 }} />
             </View>
           </View>
         )}

         {role === 'treasurer' && (
           <AppButton title="Voir les paiements reçus" onPress={() => navigation.navigate('Payer')} />
         )}

         {role === 'member' && (
           <View style={s.actionsInner}>
             {isPaid ? (
               <AppButton title="Contribution payée ce mois ✓" onPress={() => {}} disabled />
             ) : (
               <AppButton title="Payer ma contribution" onPress={() => navigation.navigate('Payer')} />
             )}
             <AppButton title="Mon historique" onPress={() => navigation.navigate('Historique')} variant="outline" style={{ marginTop: 10 }} />
           </View>
         )}
      </View>

      {/* BOTTOM SHEET MODAL */}
      <BottomSheet visible={showAllMembersModal} title="Tous les membres" onClose={() => setShowAllMembersModal(false)}>
         <FlatList
           data={members}
           keyExtractor={i => i.uid}
           style={{ maxHeight: Platform.OS === 'ios' ? 500 : 400 }}
           showsVerticalScrollIndicator={false}
           renderItem={({ item }) => {
             const hidePaymentBadge = role === 'member' && !config?.paymentsVisible;
             return (
               <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.outlineVariant + '30', paddingHorizontal: 16 }}>
                 <MemberCard
                   member={{
                     id: item.uid,
                     fullName: item.full_name || item.phone || 'Membre',
                     phone: item.phone ?? '',
                     role: (item.role as any) ?? 'member',
                     status: (item.status as any) ?? 'active',
                     paymentStatus: hidePaymentBadge ? null : ((item.paymentStatus as any) ?? null),
                     joinedAt: item.joined_at
                       ? (typeof item.joined_at?.toDate === 'function'
                           ? item.joined_at.toDate().toISOString()
                           : String(item.joined_at))
                       : new Date().toISOString(),
                   } as any}
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

  // ── Hero Banner ──
  heroBanner: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 0,
  },
  heroBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
  },
  editBtnText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroAvatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  heroAvatar: { width: '100%', height: '100%' },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarInitials: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.primary,
  },
  heroMeta: { flex: 1 },
  heroEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 26,
    marginBottom: 3,
  },
  heroDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 17,
  },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  heroStatCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 8,
  },
  heroStatValue: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: Colors.gold,
    lineHeight: 22,
  },
  heroStatLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 2,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },

  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
    flex: 1,
  },
  memberCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.statusPaid + '18',
  },
  memberCountText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.statusPaid,
    fontWeight: '700',
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
    overflow: 'hidden',
    ...Shadow.card,
  },

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant + '40',
  },
  seeAllBtnText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },

  // ── Treasurer Card ──
  treasurerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
    overflow: 'hidden',
    ...Shadow.card,
  },
  treasurerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  treasurerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.gold + '40',
    flexShrink: 0,
  },
  treasurerAvatarTxt: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.primary,
  },
  treasurerName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  treasurerPhone: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  treasurerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    padding: 6,
  },
  treasurerEditTxt: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.primary,
  },
  treasurerFooter: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant + '40',
    paddingTop: 10,
  },
  operatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.full,
  },
  operatorPillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },

  // ── Bottom Actions ──
  bottomActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '30',
    ...Shadow.card,
  },
  actionsInner: {
    gap: 0,
  },
  actionsSecondRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});

const sk = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    gap: 14,
    marginBottom: 4,
    ...Shadow.card,
  },
  line: {
    height: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.sm,
  },
});

const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,30,39,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    zIndex: 100,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginTop: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '50',
  },
  title: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  closeBtn: { padding: 4 },
});

/**
 * SCR-014 — Gestion des Membres
 * MemberManagementScreen.tsx
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Platform,
    RefreshControl, StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { AppButton } from '../../components/common/AppButton';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { InvitationRow, type InvitationData } from '../../components/common/InvitationRow';
import { MemberCard, type MemberCardData, type MemberRole } from '../../components/common/MemberCard';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import {
    cancelInvitation,
    fetchGroupMembers,
    fetchPendingInvitations,
    remindMember,
    updateMemberRole, updateMemberStatus,
    type GroupMember, type PendingInvitation,
} from '../../services/groupService';

type FilterKey = 'all' | 'active' | 'late' | 'invited';

// ─── Bottom Sheet ─────────────────────────────────────────────
interface BottomSheetProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
}
function BottomSheet({ title, children, onClose }: BottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, []);
  const close = (cb?: () => void) => {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      onClose(); cb?.();
    });
  };
  return (
    <TouchableOpacity style={bs.overlay} activeOpacity={1} onPress={() => close()}>
      <Animated.View style={[bs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={1}>
          <View style={bs.handle} />
          {typeof title === 'string' ? <Text style={bs.title}>{title}</Text> : title}
          {children}
          <TouchableOpacity style={bs.closeBtn} onPress={() => close()}>
            <Text style={bs.closeBtnText}>Annuler</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[sk.row, { opacity }]}>
      <View style={sk.avatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[sk.line, { width: '55%' }]} />
        <View style={[sk.line, { width: '35%' }]} />
      </View>
      <View style={[sk.line, { width: 64 }]} />
    </Animated.View>
  );
}

// ─── Écran principal ──────────────────────────────────────────
export default function MemberManagementScreen({ navigation, route }: any) {
  const groupId = "todo-use-actual-id"; // Assuming route.params.groupId or store
  
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Flow modales & bottom sheets
  const [memberTarget, setMemberTarget] = useState<GroupMember | null>(null);
  const [bsContent, setBsContent] = useState<'main' | 'role' | null>(null);
  const [confirmData, setConfirmData] = useState<{
    message: string;
    action: () => void;
    destructive?: boolean;
    cancelText?: string;
  } | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchGroupMembers(groupId);
      setMembers(data);
      if (filter === 'invited') {
        const invs = await fetchPendingInvitations(groupId);
        setInvitations(invs);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les données.' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [groupId, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Filtrage ──
  const allCount = members.filter(m => m.status !== 'removed').length;
  const activeCount = members.filter(m => m.status === 'active').length;
  const lateCount = members.filter(m => m.paymentStatus === 'EN_RETARD').length;
  const invitedCount = invitations.length;

  const displayedMembers = useMemo(() => {
    let list = members;
    if (filter === 'all') {
      list = list.filter(m => m.status !== 'removed');
    } else if (filter === 'active') {
      list = list.filter(m => m.status === 'active');
    } else if (filter === 'late') {
      list = list.filter(m => m.paymentStatus === 'EN_RETARD');
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(m => m.fullName.toLowerCase().includes(q) || m.phone.includes(q));
    }
    return list;
  }, [members, filter, search]);

  const displayedInvitations = useMemo(() => {
    let list = invitations;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(inv => inv.phone.includes(q));
    }
    return list;
  }, [invitations, search]);

  // ── Actions ──
  const handleRemind = async (m: GroupMember) => {
    try {
      await remindMember(m.id);
      Toast.show({ type: 'success', text1: 'Rappel envoyé', text2: `Rappel envoyé à ${m.fullName}` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Le rappel n\'a pas pu être envoyé.' });
    }
  };

  const handleMemberAction = (mCard: MemberCardData, action: 'remind' | 'edit_role' | 'suspend' | 'main') => {
    const m = members.find(x => x.id === mCard.id)!;
    if (action === 'remind') {
      handleRemind(m);
    } else if (action === 'edit_role') {
      setMemberTarget(m);
      setBsContent('role');
    } else if (action === 'suspend') {
      setMemberTarget(m);
      setBsContent('main'); // On peut l'amener direct au main qui montre suspendre
    } else if (action === 'main') {
      setMemberTarget(m);
      setBsContent('main');
    }
  };

  // Actions de Rôle
  const doChangeRole = async (target: GroupMember, role: MemberRole) => {
    setMemberTarget(null);
    try {
      await updateMemberRole(groupId, target.id, role);
      setMembers(prev => prev.map(m => m.id === target.id ? { ...m, role } : m));
      Toast.show({ type: 'success', text1: 'Rôle mis à jour' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Modification échouée.' });
    }
  };

  const requestChangeRole = (role: MemberRole) => {
    setBsContent(null);
    if (!memberTarget) return;
    if (role === 'treasurer') {
      setConfirmData({
        message: 'Ce membre deviendra la nouvelle trésorière. L\'ancienne trésorière redeviendra simple membre. Confirmer ?',
        action: () => doChangeRole(memberTarget, 'treasurer')
      });
    } else {
      doChangeRole(memberTarget, role);
    }
  };

  // Actions Statut
  const doUpdateStatus = async (target: GroupMember, status: 'active' | 'suspended' | 'removed') => {
    setMemberTarget(null);
    try {
      if (status === 'active') {
        // TODO: Implémenter la réactivation de membre côté backend
        await updateMemberStatus(groupId, target.id, 'active' as any);
        Toast.show({ type: 'success', text1: 'Membre réactivé' });
      } else {
        await updateMemberStatus(groupId, target.id, status);
        if (status === 'suspended') {
          Toast.show({ type: 'success', text1: 'Membre suspendu' });
        } else {
          Toast.show({ type: 'success', text1: 'Membre retiré du groupe' });
        }
      }
      setMembers(prev => prev.map(m => m.id === target.id ? { ...m, status } : m));
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de modifier.' });
    }
  };

  const requestSuspend = () => {
    if (!memberTarget) return;
    setBsContent(null);
    setConfirmData({
      message: `Suspendre ${memberTarget.fullName} ? Son accès sera désactivé mais son historique est conservé.`,
      action: () => doUpdateStatus(memberTarget, 'suspended')
    });
  };

  const requestReactivate = () => {
    if (!memberTarget) return;
    setBsContent(null);
    doUpdateStatus(memberTarget, 'active');
  };

  const requestRemove = () => {
    if (!memberTarget) return;
    setBsContent(null);
    setConfirmData({
      message: `Retirer ${memberTarget.fullName} du groupe ? Cette action est irréversible. Son historique de paiements est conservé.`,
      destructive: true,
      action: () => doUpdateStatus(memberTarget, 'removed')
    });
  };
  
  const handleSendMessage = () => {
    setBsContent(null);
    navigation.navigate('Notifications', { selectedUserId: memberTarget?.id });
  };

  // Actions Invitation
  const doCancelInvitation = async (invId: string) => {
    // Optimistic update
    const previous = [...invitations];
    setInvitations(prev => prev.filter(i => i.id !== invId));
    try {
      await cancelInvitation(groupId, invId);
    } catch {
      setInvitations(previous);
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible d\'annuler l\'invitation.' });
    }
  };

  const requestCancelInvitation = (inv: InvitationData) => {
    setConfirmData({
      message: `Annuler l'invitation envoyée à ${inv.phone} ?`,
      action: () => doCancelInvitation(inv.id)
    });
  };

  // ── Renders ──
  const renderFilterChip = (fKey: FilterKey, label: string, count: number) => {
    const isActive = filter === fKey;
    return (
      <TouchableOpacity
        key={fKey}
        style={[s.chip, isActive && s.chipActive]}
        onPress={() => {
          setFilter(fKey);
          if (fKey === 'invited' && invitations.length === 0) {
            fetchPendingInvitations(groupId).then(setInvitations);
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={[s.chipText, isActive && s.chipTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      {/* ════ HEADER ════ */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Membres du groupe</Text>
          <Text style={s.counter}>{activeCount} membres actifs / {allCount} total</Text>
        </View>
        <TouchableOpacity style={s.fabBtn} onPress={() => navigation.navigate('Invitations')} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ════ RECHERCHE ════ */}
      <View style={s.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Rechercher par nom ou numéro..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
            <MaterialCommunityIcons name="close" size={16} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* ════ FILTRES ════ */}
      <View style={{ height: 48 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersContent}
          data={[
            { key: 'all', label: 'Tous', count: allCount },
            { key: 'active', label: 'Actifs', count: activeCount },
            { key: 'late', label: 'En retard', count: lateCount },
            { key: 'invited', label: 'Invitations en attente', count: invitedCount },
          ]}
          keyExtractor={item => item.key}
          renderItem={({ item }) => renderFilterChip(item.key as FilterKey, item.label, item.count)}
        />
      </View>

      {isOffline && <OfflineBanner className="mb-2" />}

      {/* ════ LISTES ════ */}
      {isLoading ? (
        <View style={{ flex: 1 }}>{[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}</View>
      ) : filter === 'invited' ? (
        <FlatList
          data={displayedInvitations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <InvitationRow 
              invitation={item as any} 
              onCancelPress={(inv) => requestCancelInvitation(inv)} 
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={<Text style={s.emptyHint}>Aucune invitation en attente.</Text>}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={displayedMembers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={() => handleMemberAction(item as any, 'main')}>
              <MemberCard
                member={{
                  id: item.id,
                  fullName: item.fullName,
                  avatar: item.avatar,
                  phone: item.phone,
                  role: item.role,
                  status: item.status,
                  paymentStatus: item.paymentStatus,
                  joinedAt: item.joinDate
                }}
                showSwipeActions={!isOffline}
                onActionPress={handleMemberAction}
              />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={<Text style={s.emptyHint}>Aucun membre trouvé.</Text>}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        />
      )}

      {/* FOOTER Inviter (dans Invitations en attente) */}
      {filter === 'invited' && (
        <View style={s.footerBtnWrap}>
          <AppButton title="Inviter un nouveau membre" onPress={() => navigation.navigate('Invitations')} />
        </View>
      )}

      {/* ════ BOTTOM SHEETS ════ */}
      {memberTarget && bsContent === 'main' && (
        <BottomSheet
          title={
            <View style={bs.headerContent}>
              <View style={bs.avatar}><Text style={bs.avatarTxt}>{memberTarget.fullName.charAt(0)}</Text></View>
              <View>
                <Text style={bs.titleName}>{memberTarget.fullName}</Text>
                <View style={bs.roleBadge}><Text style={bs.roleTxt}>{memberTarget.role.toUpperCase()}</Text></View>
              </View>
            </View>
          }
          onClose={() => setMemberTarget(null)}
        >
          <View style={{ paddingTop: 8 }}>
            <TouchableOpacity style={bs.actionRow} onPress={() => setBsContent('role')}>
              <MaterialCommunityIcons name="badge-account-horizontal-outline" size={24} color={Colors.onSurfaceVariant} />
              <Text style={bs.actionText}>Changer le rôle</Text>
            </TouchableOpacity>
            
            {memberTarget.status === 'active' && (
              <TouchableOpacity style={bs.actionRow} onPress={requestSuspend}>
                <MaterialCommunityIcons name="pause-circle-outline" size={24} color="#EF6C00" />
                <Text style={[bs.actionText, { color: '#EF6C00' }]}>Suspendre le membre</Text>
              </TouchableOpacity>
            )}
            {memberTarget.status === 'suspended' && (
              <TouchableOpacity style={bs.actionRow} onPress={requestReactivate}>
                <MaterialCommunityIcons name="play-circle-outline" size={24} color="#2E7D32" />
                <Text style={[bs.actionText, { color: '#2E7D32' }]}>Réactiver le membre</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={bs.actionRow} onPress={requestRemove}>
              <MaterialCommunityIcons name="logout" size={24} color="#C62828" />
              <Text style={[bs.actionText, { color: '#C62828' }]}>Retirer du groupe</Text>
            </TouchableOpacity>

            <TouchableOpacity style={bs.actionRow} onPress={handleSendMessage}>
              <MaterialCommunityIcons name="message-text-outline" size={24} color="#1565C0" />
              <Text style={[bs.actionText, { color: '#1565C0' }]}>Envoyer un message</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      )}

      {memberTarget && bsContent === 'role' && (
        <BottomSheet title={`Rôle de ${memberTarget.fullName}`} onClose={() => setMemberTarget(null)}>
          <View style={{ paddingTop: 8 }}>
            {(['member', 'treasurer', 'auditor'] as MemberRole[]).map(r => (
              <TouchableOpacity key={r} style={bs.roleOption} onPress={() => requestChangeRole(r)}>
                <MaterialCommunityIcons 
                  name={memberTarget.role === r ? 'radiobox-marked' : 'radiobox-blank'} 
                  size={24} color={memberTarget.role === r ? Colors.primary : Colors.textMuted} 
                />
                <Text style={bs.roleText}>{r === 'treasurer' ? 'Trésorière' : r === 'auditor' ? 'Auditeur' : 'Membre'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheet>
      )}

      {/* Modal ConfirmModal (pour les modales de confirmation impératives) */}
      <ConfirmModal
        visible={!!confirmData}
        message={confirmData?.message || ''}
        isDestructive={confirmData?.destructive}
        onConfirm={() => {
          confirmData?.action();
          setConfirmData(null);
        }}
        onCancel={() => setConfirmData(null)}
      />
    </GestureHandlerRootView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 24, color: Colors.onSurface, letterSpacing: -0.5 },
  counter: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  fabBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', ...Shadow.fab
  },
  
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, paddingHorizontal: 10, fontFamily: Fonts.body, fontSize: 15, color: Colors.onSurface },
  clearBtn: { padding: 4 },

  filtersContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh, justifyContent: 'center'
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.onSurfaceVariant },
  chipTextActive: { color: '#FFF' },

  emptyHint: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  
  footerBtnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surfaceContainerLowest, padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderColor: '#EEE'
  }
});

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '30',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainerHigh },
  line: { height: 12, borderRadius: Radius.sm, backgroundColor: Colors.surfaceContainerHigh },
});

const bs = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,30,39,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  handle: { width: 36, height: 4, borderRadius: Radius.full, backgroundColor: Colors.outlineVariant, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  title: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '50' },
  closeBtn: { marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center' },
  closeBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.onSurfaceVariant },
  
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.outlineVariant + '50', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: Colors.primary, fontFamily: Fonts.headline },
  titleName: { fontFamily: Fonts.headline, fontSize: 16 },
  roleBadge: { backgroundColor: '#E0E0E0', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  roleTxt: { fontSize: 10, fontFamily: Fonts.label, color: '#424242' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '30' },
  actionText: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.onSurfaceVariant },

  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '30' },
  roleText: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.onSurface },
});

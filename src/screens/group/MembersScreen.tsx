import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';
import { MemberCard, type MemberCardData } from '../../components/common/MemberCard';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ToastNotification } from '../../components/common/ToastNotification';

export default function MembersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, groupId, uid } = useAuthStore();
  const isAdmin = useAuthStore(s => s.role === 'admin');

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [selectedMember, setSelectedMember] = useState<MemberCardData | null>(null);
  const [pendingAction, setPendingAction] = useState<'remind' | 'edit_role' | 'suspend' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await db.getMembersOfGroup(groupId);
      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
      showToast('Erreur de chargement des membres', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = (member: MemberCardData, action: 'remind' | 'edit_role' | 'suspend') => {
    setSelectedMember(member);
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!selectedMember || !pendingAction) return;

    try {
      // Logic for various actions would happen here via a service call
      // For now, we simulate a success
      showToast(`Action ${pendingAction} effectuée sur ${selectedMember.fullName.split(' ')[0]}`, 'success');
    } catch (e) {
      showToast('Une erreur est survenue', 'error');
    } finally {
      setSelectedMember(null);
      setPendingAction(null);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m =>
      (m.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.phone || '').includes(search)
    ).map(m => ({
      id: m.id,
      fullName: m.full_name || 'Utilisateur',
      avatar: m.profile_photo_url || null,
      phone: m.phone || '',
      role: m.member_role || 'member',
      status: m.status || 'active',
      paymentStatus: null,
      joinedAt: m.joined_at
        ? (typeof m.joined_at?.toDate === 'function'
            ? m.joined_at.toDate().toISOString()
            : String(m.joined_at))
        : null
    } as MemberCardData));
  }, [members, search]);

  const activeCount = filteredMembers.filter(m => m.status === 'active').length;
  const pendingCount = filteredMembers.filter(m => m.status === 'suspended').length;

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            placeholder="Rechercher un membre..."
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.inviteChip}
          onPress={() => navigation.navigate('InviteHub')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
          <Text style={styles.inviteChipText}>Inviter</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Chips */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <View style={[styles.statDot, { backgroundColor: Colors.statusPaid }]} />
          <Text style={styles.statChipText}>{activeCount} actif{activeCount > 1 ? 's' : ''}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.statChip}>
            <View style={[styles.statDot, { backgroundColor: Colors.statusPending }]} />
            <Text style={styles.statChipText}>{pendingCount} suspendu{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
        {search.length > 0 && (
          <View style={[styles.statChip, { backgroundColor: Colors.primary + '12' }]}>
            <Text style={[styles.statChipText, { color: Colors.primary }]}>{filteredMembers.length} résultat{filteredMembers.length > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {isAdmin && (
        <View style={styles.swipeHint}>
          <Ionicons name="swap-horizontal" size={12} color={Colors.textMuted} />
          <Text style={styles.swipeHintText}>Glissez une fiche pour rappeler, changer le rôle ou suspendre</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Top Banner Header ── */}
      <View style={[styles.topBanner, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <View style={styles.topBannerCenter}>
          <Text style={styles.topBannerEyebrow}>Groupe · Gestion</Text>
          <Text style={styles.topBannerTitle}>Membres</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeCount}>{members.length}</Text>
          <Text style={styles.totalBadgeLabel}>total</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des membres…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              onActionPress={handleAction}
              showSwipeActions={isAdmin && item.id !== uid}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons name="account-search-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {search.length > 0 ? 'Aucun résultat' : 'Aucun membre'}
              </Text>
              <Text style={styles.emptySub}>
                {search.length > 0
                  ? `Aucun membre ne correspond à "${search}".`
                  : 'Invitez des membres pour qu\'ils rejoignent le groupe.'}
              </Text>
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchText}>Effacer la recherche</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={members.length === 0 ? { flex: 1 } : { paddingBottom: 120 }}
        />
      )}

      {/* FAB */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('InviteHub')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {toast && (
        <View style={styles.toastHost}>
          <ToastNotification message={toast.message} type={toast.type} onHide={() => setToast(null)} />
        </View>
      )}

      <ConfirmModal
        visible={!!pendingAction}
        title={
          pendingAction === 'suspend' ? 'Suspendre le membre ?' :
          pendingAction === 'remind' ? 'Envoyer un rappel ?' : 'Changer le rôle ?'
        }
        message={`Voulez-vous vraiment ${
          pendingAction === 'suspend' ? 'suspendre' :
          pendingAction === 'remind' ? 'envoyer un rappel à' : 'modifier le rôle de'
        } ${selectedMember?.fullName} ?`}
        onConfirm={confirmAction}
        onCancel={() => { setSelectedMember(null); setPendingAction(null); }}
        confirmText="Confirmer"
        cancelText="Annuler"
        isDestructive={pendingAction === 'suspend'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Top Banner ──
  topBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  topBannerCenter: {
    flex: 1,
  },
  topBannerEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  topBannerTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  totalBadgeCount: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: Colors.gold,
    lineHeight: 22,
  },
  totalBadgeLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Loading ──
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // ── List Header ──
  listHeader: {
    padding: 16,
    paddingBottom: 4,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.onSurface,
  },
  inviteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    flexShrink: 0,
  },
  inviteChipText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statChipText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  swipeHintText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearSearchBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
  },
  clearSearchText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.fab,
  },

  toastHost: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
});

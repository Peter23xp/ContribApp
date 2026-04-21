import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, 
  TouchableOpacity, ActivityIndicator, RefreshControl, SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';
import { MemberCard, type MemberCardData } from '../../components/common/MemberCard';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ToastNotification } from '../../components/common/ToastNotification';

export default function MembersScreen({ navigation }: any) {
  const { user, groupId } = useAuthStore();
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
      paymentStatus: null, // Would be fetched from contributions if needed
      joinedAt: m.joined_at?.toDate?.()?.toISOString() || new Date().toISOString()
    } as MemberCardData));
  }, [members, search]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          placeholder="Rechercher un membre..."
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.countText}>{filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}</Text>
        <TouchableOpacity 
          style={styles.inviteButton}
          onPress={() => navigation.navigate('InviteHub')}
        >
          <Ionicons name="person-add" size={16} color={Colors.primary} />
          <Text style={styles.inviteText}>Inviter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des Membres</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
              showSwipeActions={isAdmin && item.id !== user?.id} 
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-search-outline" size={64} color={Colors.outlineVariant} />
              <Text style={styles.emptyTitle}>Aucun membre trouvé</Text>
              <Text style={styles.emptySub}>Essayez de modifier votre recherche ou invitez de nouveaux membres.</Text>
            </View>
          }
          contentContainerStyle={members.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
        />
      )}

      {isAdmin && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('InviteHub')}
        >
          <Ionicons name="add" size={32} color="#FFF" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '33',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  headerContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '22',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.onSurface,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 6,
  },
  inviteText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    color: Colors.onSurface,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
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

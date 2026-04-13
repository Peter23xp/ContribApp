import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { MonthPickerSelector, SummaryBanner } from '../../components/common';
import { TransactionRow } from '../../components/payment/TransactionRow';
import {
  exportContributions,
  fetchGroupContributions,
  sendMemberReminder,
  type ContributionFilter,
  type ContributionItem,
  type ContributionSort,
  type ContributionSummary,
} from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';

type StatusFilter = 'all' | 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'amount_desc';

interface MemberOption {
  id: string;
  fullName: string;
}

interface ActionSheetState {
  visible: boolean;
  item: ContributionItem | null;
}

const PAGE_SIZE = 20;

const FILTER_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'PAYE', label: 'Payes' },
  { key: 'EN_ATTENTE', label: 'En attente' },
  { key: 'EN_RETARD', label: 'En retard' },
  { key: 'ECHEC', label: 'Echecs' },
];

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'date_desc', label: 'Date ↓' },
  { key: 'date_asc', label: 'Date ↑' },
  { key: 'name_asc', label: 'Nom A-Z' },
  { key: 'amount_desc', label: 'Montant ↓' },
];

const localCache = new Map<string, { items: ContributionItem[]; summary: ContributionSummary; hasMore: boolean; total: number }>();

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function currentMonthKey() {
  return toYearMonth(new Date());
}

function defaultSummary(): ContributionSummary {
  return {
    collectedAmount: 0,
    expectedAmount: 0,
    totalMembers: 0,
    paidCount: 0,
    pendingCount: 0,
    lateCount: 0,
    failedCount: 0,
  };
}

export default function FullHistoryScreen({ navigation, route }: any) {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  const group = useMemo(() => {
    if (!user?.id) return null;
    if (role === 'admin') return db.getGroupForAdmin(user.id);
    return db.getGroupForMember(user.id);
  }, [user?.id, role]);

  const presetMonth: string | undefined = route?.params?.presetMonth;
  const presetStatus: StatusFilter | undefined = route?.params?.presetStatus;
  const presetMemberId: string | undefined = route?.params?.presetMemberId;

  const [selectedMonth, setSelectedMonth] = useState<string>(presetMonth ?? currentMonthKey());
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>(presetStatus ?? 'all');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(presetMemberId ?? null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [page, setPage] = useState(1);
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  const [summary, setSummary] = useState<ContributionSummary>(defaultSummary());
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActionSheetState>({ visible: false, item: null });

  const listRef = useRef<FlatList<ContributionItem>>(null);
  const initializedFromPreset = useRef(false);

  const cacheKey = useMemo(
    () => `${group?.id ?? 'nogroup'}|${selectedMonth}|${activeStatusFilter}|${selectedMemberId ?? 'all'}|${sortOption}`,
    [group?.id, selectedMonth, activeStatusFilter, selectedMemberId, sortOption],
  );

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOffline(!(state.isConnected ?? true)));
    return unsub;
  }, []);

  useEffect(() => {
    if (!group?.id) return;
    const rows = db.getMembersOfGroup(group.id) ?? [];
    setMembers(rows.map((m: any) => ({ id: m.id, fullName: m.full_name })));
  }, [group?.id]);

  useEffect(() => {
    if (initializedFromPreset.current) return;
    initializedFromPreset.current = true;
    if (presetMonth) setSelectedMonth(presetMonth);
    if (presetStatus) setActiveStatusFilter(presetStatus);
    if (presetMemberId) setSelectedMemberId(presetMemberId);
  }, [presetMonth, presetStatus, presetMemberId]);

  const loadData = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!group?.id) return;

      const useCacheFirst = nextPage === 1 && !refreshing;
      if (useCacheFirst) {
        const cached = localCache.get(cacheKey);
        if (cached) {
          setContributions(cached.items);
          setSummary(cached.summary);
          setHasMore(cached.hasMore);
          setTotal(cached.total);
          setPage(1);
          setIsLoading(false);
        }
      }

      try {
        if (nextPage === 1 && !append) setIsLoading(true);
        if (nextPage > 1) setIsLoadingMore(true);

        const result = await fetchGroupContributions(
          group.id,
          selectedMonth,
          activeStatusFilter as ContributionFilter,
          nextPage,
          PAGE_SIZE,
          {
            memberId: selectedMemberId,
            sort: sortOption as ContributionSort,
          },
        );

        setContributions((prev) => (append ? [...prev, ...result.items] : result.items));
        setSummary(result.summary);
        setHasMore(result.hasMore);
        setTotal(result.total);
        setPage(nextPage);

        if (nextPage === 1) {
          localCache.set(cacheKey, {
            items: result.items,
            summary: result.summary,
            hasMore: result.hasMore,
            total: result.total,
          });
        }
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Impossible de charger les contributions.',
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setRefreshing(false);
      }
    },
    [group?.id, selectedMonth, activeStatusFilter, selectedMemberId, sortOption, refreshing, cacheKey],
  );

  useEffect(() => {
    setPage(1);
    setContributions([]);
    loadData(1, false);
  }, [selectedMonth, activeStatusFilter, selectedMemberId, sortOption, loadData]);

  useFocusEffect(
    useCallback(() => {
      const updatedTxId = route?.params?.updatedTxId;
      const updatedStatus = route?.params?.updatedStatus;
      if (updatedTxId && updatedStatus) {
        setContributions((prev) =>
          prev.map((item) => (item.txReference === updatedTxId ? { ...item, status: updatedStatus } : item)),
        );
        navigation.setParams({ updatedTxId: undefined, updatedStatus: undefined });
      }
    }, [route?.params?.updatedTxId, route?.params?.updatedStatus, navigation]),
  );

  const selectedMemberLabel = useMemo(() => {
    if (!selectedMemberId) return 'Tous les membres ▾';
    const selected = members.find((m) => m.id === selectedMemberId);
    return `${selected?.fullName ?? 'Membre'} ▾`;
  }, [selectedMemberId, members]);

  const completionRate = useMemo(() => {
    if (summary.expectedAmount <= 0) return 0;
    return Math.min(100, Math.round((summary.collectedAmount / summary.expectedAmount) * 100));
  }, [summary.collectedAmount, summary.expectedAmount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    localCache.delete(cacheKey);
    setPage(1);
    loadData(1, false);
  }, [loadData, cacheKey]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    const nextPage = page + 1;
    loadData(nextPage, true);
  }, [hasMore, isLoadingMore, isLoading, page, loadData]);

  const clearFilters = useCallback(() => {
    setSelectedMonth(currentMonthKey());
    setActiveStatusFilter('all');
    setSelectedMemberId(null);
    setSortOption('date_desc');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleExport = useCallback(async () => {
    if (!group?.id || isOffline) return;
    setIsExporting(true);
    try {
      const { downloadUrl } = await exportContributions(group.id, selectedMonth, 'xlsx');
      const filename = `contributions_${selectedMonth}.xlsx`;
      const destination = `${FileSystem.documentDirectory ?? ''}${filename}`;

      await FileSystem.downloadAsync(downloadUrl, destination);
      Toast.show({
        type: 'success',
        text1: 'Fichier Excel sauvegarde',
      });

      await Sharing.shareAsync(destination, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Partager le rapport',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Export impossible',
        text2: 'Le fichier Excel n a pas pu etre genere.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [group?.id, selectedMonth, isOffline]);

  const handleRowPress = useCallback(
    (item: ContributionItem) => {
      if (item.status === 'PAYE') {
        navigation.navigate('Receipt', { txId: item.txReference });
        return;
      }
      setActionSheet({ visible: true, item });
    },
    [navigation],
  );

  const handleRemind = useCallback(async (item: ContributionItem) => {
    try {
      await sendMemberReminder(item.memberId);
      Toast.show({
        type: 'success',
        text1: 'Rappel envoye',
        text2: `${item.memberName} a recu un rappel.`,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Echec du rappel',
      });
    } finally {
      setActionSheet({ visible: false, item: null });
    }
  }, []);

  const handleViewProfile = useCallback(
    (item: ContributionItem) => {
      setActionSheet({ visible: false, item: null });
      if (role !== 'admin') return;
      navigation.navigate('MemberManagement', { presetMemberId: item.memberId });
    },
    [navigation, role],
  );

  const renderItem = useCallback(
    ({ item }: { item: ContributionItem }) => (
      <TransactionRow
        memberName={item.memberName}
        memberAvatar={item.memberAvatar}
        amount={item.amount}
        currency={item.currency}
        operator={item.operator ?? 'airtel'}
        date={item.paidAt ?? new Date().toISOString()}
        status={item.status}
        txReference={item.txReference}
        onPress={() => handleRowPress(item)}
      />
    ),
    [handleRowPress],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique des contributions</Text>
        <TouchableOpacity
          style={[styles.exportBtn, (isOffline || isExporting) && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={isOffline || isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialCommunityIcons name="upload" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
          <Text style={styles.offlineText}>Mode hors-ligne — cache local actif</Text>
        </View>
      )}

      <View style={styles.stickyBlock}>
        <MonthPickerSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} maxMonth={currentMonthKey()} />

        <View style={styles.rowScroll}>
          {FILTER_CHIPS.map((chip) => {
            const active = chip.key === activeStatusFilter;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveStatusFilter(chip.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.memberSelector} onPress={() => setMemberModalVisible(true)}>
          <Text style={styles.memberSelectorText}>{selectedMemberLabel}</Text>
        </TouchableOpacity>

        <SummaryBanner
          collectedAmount={summary.collectedAmount}
          expectedAmount={summary.expectedAmount}
          currency={'CDF'}
          paidCount={summary.paidCount}
          totalMembers={summary.totalMembers}
          completionRate={completionRate}
        />

        <View style={styles.rowScroll}>
          {SORT_OPTIONS.map((sort) => {
            const active = sort.key === sortOption;
            return (
              <TouchableOpacity
                key={sort.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortOption(sort.key)}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{sort.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={contributions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Aucune contribution pour ce filtre.</Text>
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Effacer les filtres</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footerWrap}>
            {isLoadingMore ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
                <Text style={styles.loadMoreText}>Charger plus</Text>
              </TouchableOpacity>
            ) : contributions.length > 0 ? (
              <Text style={styles.footerEndText}>{total} transaction(s) affichee(s)</Text>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des contributions...</Text>
        </View>
      )}

      <Modal visible={memberModalVisible} transparent animationType="fade" onRequestClose={() => setMemberModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMemberModalVisible(false)}>
          <Pressable style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => {
                setSelectedMemberId(null);
                setMemberModalVisible(false);
              }}
            >
              <Text style={styles.modalRowText}>Tous les membres</Text>
            </TouchableOpacity>
            {members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.modalRow}
                onPress={() => {
                  setSelectedMemberId(member.id);
                  setMemberModalVisible(false);
                }}
              >
                <Text style={styles.modalRowText}>{member.fullName}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={actionSheet.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheet({ visible: false, item: null })}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActionSheet({ visible: false, item: null })}>
          <Pressable style={styles.sheet}>
            {actionSheet.item?.status === 'EN_ATTENTE' || actionSheet.item?.status === 'EN_RETARD' ? (
              <>
                <TouchableOpacity style={styles.sheetAction} onPress={() => actionSheet.item && handleRemind(actionSheet.item)}>
                  <Text style={styles.sheetActionText}>Envoyer un rappel</Text>
                </TouchableOpacity>
                {role === 'admin' && (
                  <TouchableOpacity style={styles.sheetAction} onPress={() => actionSheet.item && handleViewProfile(actionSheet.item)}>
                    <Text style={styles.sheetActionText}>Voir le profil</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            {actionSheet.item?.status === 'ECHEC' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{actionSheet.item.errorMessage ?? 'Echec de transaction.'}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 34,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  exportBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  exportBtnDisabled: {
    opacity: 0.45,
  },
  offlineBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.offline,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    fontSize: 12,
    color: '#795501',
    fontFamily: Fonts.body,
  },
  stickyBlock: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 8,
  },
  rowScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontFamily: Fonts.title,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  chipTextActive: {
    color: '#FFF',
  },
  memberSelector: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memberSelectorText: {
    fontFamily: Fonts.body,
    color: Colors.onSurface,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  sortChipActive: {
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.primary,
  },
  sortChipText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontFamily: Fonts.title,
  },
  sortChipTextActive: {
    color: Colors.primary,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 48,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  clearBtn: {
    borderWidth: 1.2,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.title,
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  loadMoreBtn: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadMoreText: {
    color: Colors.onSurface,
    fontFamily: Fonts.title,
    fontSize: 12,
  },
  footerEndText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFFCC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: Fonts.body,
    color: Colors.onSurfaceVariant,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    paddingVertical: 8,
    ...Shadow.card,
  },
  modalRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalRowText: {
    fontFamily: Fonts.body,
    color: Colors.onSurface,
  },
  sheet: {
    marginTop: 'auto',
    marginHorizontal: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingVertical: 10,
    ...Shadow.fab,
  },
  sheetAction: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetActionText: {
    fontFamily: Fonts.title,
    color: Colors.onSurface,
  },
  errorBox: {
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.md,
    padding: 12,
  },
  errorText: {
    color: Colors.onErrorContainer,
    fontFamily: Fonts.body,
  },
});

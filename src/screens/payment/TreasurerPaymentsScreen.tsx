/**
 * SCR-009 — Paiements Reçus (Vue Trésorière)
 * TreasurerPaymentsScreen.tsx
 *
 * Rôle : Trésorière uniquement
 * Position : Tab 2 "Contributions" de la Bottom Tab Bar
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
  StatusBar, Platform, Share, Linking, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar }    from '../../components/common/ProgressBar';
import { TransactionRow } from '../../components/payment/TransactionRow';
import { OPERATORS }      from '../../constants/operators';
import {
  fetchPaidContributions,
  exportContributions,
  type ContributionItem,
  type ContributionSummary,
} from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';

// ─── Constantes ──────────────────────────────────────────────

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

type OperatorFilter = 'all' | 'airtel' | 'orange' | 'mpesa' | 'mtn';

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function isFutureMonth(ym: string): boolean {
  const now = new Date();
  const d   = parseYearMonth(ym);
  return d.getFullYear() > now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth());
}

// ─── Sous-composants ─────────────────────────────────────────

function OfflineBannerLocal() {
  return (
    <View style={s.offlineBanner}>
      <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
      <Text style={s.offlineText}>Mode hors-ligne — données locales uniquement</Text>
    </View>
  );
}

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.skeletonRow, { opacity }]}>
      <View style={s.skeletonAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[s.skeletonLine, { width: '55%' }]} />
        <View style={[s.skeletonLine, { width: '35%' }]} />
      </View>
      <View style={[s.skeletonLine, { width: 64 }]} />
    </Animated.View>
  );
}

// ─── Écran principal ─────────────────────────────────────────

export default function TreasurerPaymentsScreen({ navigation }: any) {
  const user  = useAuthStore(s => s.user);
  const group = db.getGroupForAdmin(user?.id ?? '');

  const [selectedMonth, setSelectedMonth] = useState<string>(toYearMonth(new Date()));
  const [opFilter,      setOpFilter]      = useState<OperatorFilter>('all');
  const [allItems,      setAllItems]      = useState<ContributionItem[]>([]);
  const [summary,       setSummary]       = useState<ContributionSummary>({
    collectedAmount: 0, expectedAmount: 0,
    totalMembers: 0, paidCount: 0, pendingCount: 0, lateCount: 0, failedCount: 0,
  });
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [isOffline,     setIsOffline]     = useState(false);
  const [exporting,     setExporting]     = useState(false);

  // Filtre opérateur côté client
  const displayItems = opFilter === 'all'
    ? allItems
    : allItems.filter(item => item.operator === opFilter);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  // ── Chargement ──
  const loadData = useCallback(async (p: number, month: string, append = false) => {
    if (!group?.id) return;
    try {
      if (p === 1) setIsLoading(true);
      else         setIsLoadingMore(true);

      const result = await fetchPaidContributions(group.id, month, p);
      setAllItems(prev => append ? [...prev, ...result.items] : result.items);
      setSummary(result.summary);
      setHasMore(result.hasMore);
      setPage(result.page);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les paiements.' });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [group?.id]);

  useEffect(() => {
    setPage(1);
    setAllItems([]);
    loadData(1, selectedMonth);
  }, [selectedMonth]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(1, selectedMonth);
  }, [selectedMonth, loadData]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) loadData(page + 1, selectedMonth, true);
  }, [hasMore, isLoadingMore, page, selectedMonth, loadData]);

  const navigateMonth = (dir: -1 | 1) => {
    const d = parseYearMonth(selectedMonth);
    d.setMonth(d.getMonth() + dir);
    setSelectedMonth(toYearMonth(d));
  };
  const displayMonth = () => {
    const d = parseYearMonth(selectedMonth);
    return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ── Export Excel ──
  const handleExport = async () => {
    if (!group?.id || isOffline) return;
    setExporting(true);
    try {
      const result = await exportContributions(group.id, selectedMonth, 'xlsx');
      await Share.share({ url: result.downloadUrl, message: `Paiements ${displayMonth()} — ContribApp` });
    } catch {
      Toast.show({ type: 'error', text1: 'Export échoué', text2: 'Impossible de générer le fichier.' });
    } finally {
      setExporting(false);
    }
  };

  // ── Tap sur une transaction → SCR-012 ──
  const handleRowPress = (item: ContributionItem) => {
    navigation.navigate('Receipt', { txId: item.txReference, receiptData: item });
  };

  // ── Totaux ──
  const totalReceived    = summary.collectedAmount;
  const nbTransactions   = summary.paidCount;
  const treasurerOpName  = OPERATORS.find(o => o.id === user?.operator)?.name ?? 'Mon compte';

  // ── Rendu items ──
  const renderItem = useCallback(({ item }: { item: ContributionItem }) => (
    <TransactionRow
      memberName={item.memberName}
      memberAvatar={item.memberAvatar}
      amount={item.amount}
      currency={item.currency}
      operator={item.operator}
      date={item.paidAt}
      status={item.status}
      txReference={item.txReference}
      onPress={() => handleRowPress(item)}
    />
  ), []);

  const renderFooter = () => {
    if (isLoadingMore) return (
      <View style={s.footerLoader}><ActivityIndicator color={Colors.primary} /></View>
    );
    if (!hasMore && displayItems.length > 0) return (
      <View style={s.footerEnd}>
        <MaterialCommunityIcons name="check-all" size={14} color={Colors.textMuted} />
        <Text style={s.footerEndText}>Tous les paiements sont affichés</Text>
      </View>
    );
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={s.emptyState}>
        <MaterialCommunityIcons
          name={isFutureMonth(selectedMonth) ? 'calendar-clock' : 'cash-remove'}
          size={56}
          color={Colors.outlineVariant}
        />
        <Text style={s.emptyTitle}>
          {isFutureMonth(selectedMonth) ? 'Mois futur' : 'Aucun paiement'}
        </Text>
        <Text style={s.emptySub}>
          {isFutureMonth(selectedMonth)
            ? 'Aucun paiement encore pour ce mois.'
            : opFilter !== 'all'
              ? 'Aucun paiement reçu pour cet opérateur.'
              : 'Aucun paiement reçu pour ce filtre.'}
        </Text>
        {opFilter !== 'all' && (
          <TouchableOpacity style={s.clearBtn} onPress={() => setOpFilter('all')}>
            <Text style={s.clearBtnText}>Voir tous les opérateurs</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {isOffline && <OfflineBannerLocal />}

      {/* ════════ HEADER ════════ */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Paiements reçus</Text>
        <View style={s.monthSelector}>
          <TouchableOpacity style={s.monthArrow} onPress={() => navigateMonth(-1)}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{displayMonth()}</Text>
          <TouchableOpacity style={s.monthArrow} onPress={() => navigateMonth(1)}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ════════ CARTE TOTAL ════════ */}
      <View style={s.totalCard}>
        <View style={s.totalLeft}>
          <Text style={s.totalLabel}>TOTAL REÇU CE MOIS</Text>
          <Text style={s.totalAmount}>
            {totalReceived.toLocaleString('fr-FR')}
            <Text style={s.totalCurrency}> CDF</Text>
          </Text>
          <View style={s.totalMeta}>
            <MaterialCommunityIcons name="swap-vertical" size={14} color={Colors.secondary} />
            <Text style={s.totalMetaText}>
              {nbTransactions} paiement{nbTransactions > 1 ? 's' : ''} reçu{nbTransactions > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={s.totalRight}>
          <View style={s.totalOpBadge}>
            <MaterialCommunityIcons name="wallet" size={22} color={Colors.primary} />
          </View>
          <Text style={s.totalOpName} numberOfLines={1}>{treasurerOpName}</Text>
        </View>
      </View>

      {/* ════════ FILTRES OPÉRATEUR ════════ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtersScroll}
        contentContainerStyle={s.filtersContent}
      >
        {[
          { key: 'all' as OperatorFilter, label: 'Tous' },
          ...OPERATORS.map(o => ({ key: o.id as OperatorFilter, label: o.name })),
        ].map(opt => {
          const isActive = opFilter === opt.key;
          const count = opt.key === 'all'
            ? allItems.length
            : allItems.filter(i => i.operator === opt.key).length;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[s.filterChip, isActive && s.filterChipActive]}
              onPress={() => setOpFilter(opt.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                {opt.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ════════ LISTE ════════ */}
      {isLoading ? (
        <View style={{ flex: 1 }}>
          {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          style={s.list}
          contentContainerStyle={[
            { paddingBottom: 8 },
            displayItems.length === 0 && { flex: 1 },
          ]}
        />
      )}

      {/* ════════ BOUTON EXPORTER (sticky bas) ════════ */}
      <View style={s.exportBar}>
        {isOffline && (
          <Text style={s.exportDisabledHint}>Export indisponible hors ligne</Text>
        )}
        <TouchableOpacity
          style={[s.exportBtn, (isOffline || exporting) && s.exportBtnDisabled]}
          onPress={handleExport}
          disabled={isOffline || exporting}
          activeOpacity={0.82}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialCommunityIcons name="microsoft-excel" size={18} color={isOffline ? Colors.textMuted : Colors.primary} />
          )}
          <Text style={[s.exportBtnText, isOffline && s.exportBtnTextDisabled]}>
            {exporting ? 'Génération du fichier…' : 'Exporter Excel (.xlsx)'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.offline,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  offlineText: { fontFamily: Fonts.body, fontSize: 12, color: '#795501' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
    shadowColor: Colors.onSurface, shadowOpacity: 0.04,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.onSurface, letterSpacing: -0.3 },
  monthSelector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.full,
    paddingVertical: 4, paddingHorizontal: 4, gap: 2,
  },
  monthArrow: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.full },
  monthLabel: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary, paddingHorizontal: 4 },

  // Carte total
  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.xl, padding: 20,
    ...Shadow.card,
  },
  totalLeft: { gap: 4 },
  totalLabel: {
    fontFamily: Fonts.label, fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.7)', letterSpacing: 1,
  },
  totalAmount: {
    fontFamily: Fonts.display, fontSize: 32,
    color: '#FFFFFF', letterSpacing: -1,
  },
  totalCurrency: { fontFamily: Fonts.headline, fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  totalMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  totalMetaText: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  totalRight: { alignItems: 'center', gap: 6 },
  totalOpBadge: {
    width: 52, height: 52, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  totalOpName: { fontFamily: Fonts.title, fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  // Filtres
  filtersScroll: { maxHeight: 52, backgroundColor: Colors.surface },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontFamily: Fonts.title, fontSize: 12, color: Colors.onSurfaceVariant },
  filterChipTextActive: { color: '#FFFFFF' },

  // Liste
  list: { flex: 1 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  footerEnd: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16 },
  footerEndText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  emptySub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  clearBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  clearBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },

  // Skeleton
  skeletonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  skeletonAvatar: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh },
  skeletonLine: { height: 12, borderRadius: Radius.sm, backgroundColor: Colors.surfaceContainerHigh },

  // Export bar sticky
  exportBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant + '50',
    gap: 6,
  },
  exportDisabledHint: {
    fontFamily: Fonts.body, fontSize: 11,
    color: Colors.warning, textAlign: 'center',
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  exportBtnDisabled: { borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerHigh },
  exportBtnText: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.primary },
  exportBtnTextDisabled: { color: Colors.textMuted },
});

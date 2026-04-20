/**
 * SCR-008 — Suivi des Paiements (Vue Administrateur)
 * AdminPaymentTrackingScreen.tsx
 *
 * Rôle : Admin uniquement
 * Position : Tab 2 "Contributions" de la Bottom Tab Bar
 */
import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
  StatusBar, Platform, Linking, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar }    from '../../components/common/ProgressBar';
import { TransactionRow } from '../../components/payment/TransactionRow';

import {
  fetchGroupContributions,
  sendMemberReminder,
  sendGroupRemindAll,
  type ContributionItem,
  type ContributionFilter,
  type ContributionSummary,
} from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';

// ─── Constantes ──────────────────────────────────────────────

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

type FilterOption = { key: ContributionFilter; label: string; countKey: keyof ContributionSummary | null };

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all',        label: 'Tous',       countKey: null          },
  { key: 'PAYE',       label: 'Payés',      countKey: 'paidCount'   },
  { key: 'EN_ATTENTE', label: 'En attente', countKey: 'pendingCount' },
  { key: 'EN_RETARD',  label: 'En retard',  countKey: 'lateCount'   },
  { key: 'ECHEC',      label: 'Échecs',     countKey: 'failedCount'  },
];

function toYearMonth(date: Date): string {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

// ─── Sous-composants ─────────────────────────────────────────

/** Bandeau hors-ligne */
function OfflineBannerLocal() {
  return (
    <View style={styles.offlineBanner}>
      <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
      <Text style={styles.offlineText}>Mode hors-ligne — données locales</Text>
    </View>
  );
}

/** Skeleton d'une ligne de transaction */
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
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonLines}>
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
      </View>
      <View style={[styles.skeletonLine, { width: 60 }]} />
    </Animated.View>
  );
}

/** BottomSheet contextuel pour les actions sur une transaction */
interface ActionSheetProps {
  item: ContributionItem;
  onClose: () => void;
  onRemind: (item: ContributionItem) => void;
  onNavigateProfile: (item: ContributionItem) => void;
  navigation: any;
}

function ActionBottomSheet({ item, onClose, onRemind, onNavigateProfile, navigation }: ActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, []);

  const close = (callback?: () => void) => {
    Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
      callback?.();
    });
  };

  const statusLabel: Record<string, string> = {
    PAYE: 'Payé', EN_ATTENTE: 'En attente', EN_RETARD: 'En retard', ECHEC: 'Échec', PARTIEL: 'Partiel',
  };

  return (
    <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => close()}>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <TouchableOpacity activeOpacity={1}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetMemberName}>{item.memberName}</Text>
            <Text style={styles.sheetStatus}>{statusLabel[item.status] ?? item.status}</Text>
          </View>

          {/* Actions selon statut */}
          {(item.status === 'EN_ATTENTE' || item.status === 'EN_RETARD') && (
            <>
              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => close(() => onRemind(item))}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: Colors.secondaryContainer }]}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color={Colors.secondary} />
                </View>
                <View style={styles.sheetActionText}>
                  <Text style={styles.sheetActionTitle}>Envoyer un rappel</Text>
                  <Text style={styles.sheetActionSub}>Notification push au membre</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => close(() => onNavigateProfile(item))}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: Colors.surfaceContainer }]}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.sheetActionText}>
                  <Text style={styles.sheetActionTitle}>Voir le profil</Text>
                  <Text style={styles.sheetActionSub}>Détails et historique du membre</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          {item.status === 'ECHEC' && (
            <>
              {item.errorMessage && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.error} />
                  <Text style={styles.errorMsg}>{item.errorMessage}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => {
                  if (item.memberPhone) Linking.openURL(`tel:${item.memberPhone}`);
                  close();
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: Colors.errorContainer }]}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color={Colors.error} />
                </View>
                <View style={styles.sheetActionText}>
                  <Text style={styles.sheetActionTitle}>Contacter le membre</Text>
                  <Text style={styles.sheetActionSub}>{item.memberPhone ?? 'Numéro inconnu'}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          {/* Bouton fermer */}
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => close()}>
            <Text style={styles.sheetCloseBtnText}>Fermer</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Écran principal ─────────────────────────────────────────

export default function AdminPaymentTrackingScreen({ navigation }: any) {
  const user    = useAuthStore(s => s.user);
  const groupId = useAuthStore(s => s.groupId);

  // ── État ──
  const [selectedMonth, setSelectedMonth] = useState<string>(toYearMonth(new Date()));
  const [activeFilter,  setActiveFilter]  = useState<ContributionFilter>('all');
  const [items,         setItems]         = useState<ContributionItem[]>([]);
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
  const [actionItem,    setActionItem]    = useState<ContributionItem | null>(null);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [isSendingAll,  setIsSendingAll]  = useState(false);

  // Compteur membres non-payés (pour FAB et modal)
  const unpaidCount = summary.pendingCount + summary.lateCount;

  // ── Réseau ──
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  // ── Chargement des données ──
  const loadContributions = useCallback(async (
    p: number, filter: ContributionFilter, month: string, append = false,
  ) => {
    if (!groupId) return;
    try {
      if (p === 1) setIsLoading(true);
      else         setIsLoadingMore(true);

      const result = await fetchGroupContributions(groupId, month, filter, p);

      setItems(prev => append ? [...prev, ...result.items] : result.items);
      setSummary(result.summary);
      setHasMore(result.hasMore);
      setPage(result.page);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Erreur de chargement',
        text2: 'Impossible de récupérer les contributions.',
      });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [groupId]);

  // Initial + changement de mois/filtre
  useEffect(() => {
    setPage(1);
    setItems([]);
    loadContributions(1, activeFilter, selectedMonth);
  }, [activeFilter, selectedMonth]);

  // ── Handlers ──

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadContributions(1, activeFilter, selectedMonth);
  }, [activeFilter, selectedMonth, loadContributions]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      const nextPage = page + 1;
      loadContributions(nextPage, activeFilter, selectedMonth, true);
    }
  }, [hasMore, isLoadingMore, page, activeFilter, selectedMonth, loadContributions]);

  /** Navigation de mois */
  const navigateMonth = (dir: -1 | 1) => {
    const current = parseYearMonth(selectedMonth);
    current.setMonth(current.getMonth() + dir);
    setSelectedMonth(toYearMonth(current));
  };

  /** Format du mois affiché */
  const displayMonth = () => {
    const d = parseYearMonth(selectedMonth);
    return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  };

  /** Tap sur une transaction */
  const handleRowPress = (item: ContributionItem) => {
    if (item.status === 'PAYE') {
      navigation.navigate('Receipt', { txId: item.txReference, receiptData: item });
    } else {
      setActionItem(item);
    }
  };

  /** Rappel individuel */
  const handleRemind = async (item: ContributionItem) => {
    try {
      await sendMemberReminder(item.memberId);
      Toast.show({ type: 'success', text1: 'Rappel envoyé', text2: `${item.memberName} a été notifié(e).` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Le rappel n\'a pas pu être envoyé.' });
    }
  };

  /** Navigation vers profil membre */
  const handleNavigateProfile = (item: ContributionItem) => {
    navigation.navigate('MemberProfile', { memberId: item.memberId });
  };

  /** Rappel groupé */
  const handleRemindAll = async () => {
    if (!groupId) return;
    setIsSendingAll(true);
    try {
      await sendGroupRemindAll(groupId);
      setShowConfirm(false);
      Toast.show({
        type: 'success',
        text1: 'Rappels envoyés',
        text2: `${unpaidCount} membre(s) notifié(s).`,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Les rappels n\'ont pas pu être envoyés.' });
    } finally {
      setIsSendingAll(false);
    }
  };

  /** Effacer les filtres */
  const clearFilters = () => {
    setActiveFilter('all');
    setSelectedMonth(toYearMonth(new Date()));
  };

  // ── Pourcentage collecté ──
  const pct = summary.expectedAmount > 0
    ? Math.round((summary.collectedAmount / summary.expectedAmount) * 100)
    : 0;
  const progressColor = pct >= 90 ? Colors.secondary : pct >= 50 ? Colors.tertiary : Colors.warning;

  // ── Rendu des items ──
  const renderItem = useCallback(({ item }: { item: ContributionItem }) => (
    <TransactionRow
      memberName={item.memberName}
      memberAvatar={item.memberAvatar || null}
      amount={item.amount}
      currency={item.currency}
      operator={item.operator as any}
      date={item.paidAt as string}
      status={item.status as any}
      txReference={item.txReference}
      onPress={() => handleRowPress(item)}
    />
  ), []);

  const renderFooter = () => {
    if (isLoadingMore) return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
    if (!hasMore && items.length > 0) return (
      <View style={styles.footerEnd}>
        <MaterialCommunityIcons name="check-all" size={16} color={Colors.textMuted} />
        <Text style={styles.footerEndText}>Toutes les contributions sont affichées</Text>
      </View>
    );
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="cash-remove" size={56} color={Colors.outlineVariant} />
        <Text style={styles.emptyTitle}>Aucune contribution</Text>
        <Text style={styles.emptySub}>Aucune contribution pour ce filtre.</Text>
        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
          <Text style={styles.clearFiltersBtnText}>Effacer les filtres</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Hors-ligne ── */}
      {isOffline && <OfflineBannerLocal />}

      {/* ════════════════════════════════════════
          HEADER
      ════════════════════════════════════════ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suivi des paiements</Text>

        {/* Sélecteur de mois */}
        <View style={styles.monthSelector}>
          <TouchableOpacity style={styles.monthArrow} onPress={() => navigateMonth(-1)}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{displayMonth()}</Text>
          <TouchableOpacity style={styles.monthArrow} onPress={() => navigateMonth(1)}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ════════════════════════════════════════
          BARRE DE FILTRES
      ════════════════════════════════════════ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTER_OPTIONS.map(opt => {
          const isActive = activeFilter === opt.key;
          const count = opt.countKey ? (summary[opt.countKey] as number) : summary.totalMembers;

          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(opt.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {opt.label}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ════════════════════════════════════════
          BANDEAU DE SYNTHÈSE
      ════════════════════════════════════════ */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryCollected}>
              {summary.collectedAmount.toLocaleString('fr-FR')}
              <Text style={styles.summaryCurrency}> CDF</Text>
            </Text>
            <Text style={styles.summaryExpected}>
              / {summary.expectedAmount.toLocaleString('fr-FR')} CDF attendus
            </Text>
          </View>
          <View style={[styles.pctBadge, { backgroundColor: progressColor + '18' }]}>
            <Text style={[styles.pctText, { color: progressColor }]}>{pct}%</Text>
          </View>
        </View>
        <View style={styles.progressWrap}>
          <ProgressBar current={pct} total={100} color={progressColor} height={6} />
        </View>
        <View style={styles.summaryStats}>
          {[
            { label: 'Payés',      count: summary.paidCount,    color: Colors.secondary },
            { label: 'En attente', count: summary.pendingCount,  color: Colors.warning   },
            { label: 'En retard',  count: summary.lateCount,    color: Colors.error     },
            { label: 'Échecs',     count: summary.failedCount,  color: Colors.textMuted },
          ].map(s => (
            <View key={s.label} style={styles.statChip}>
              <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ════════════════════════════════════════
          LISTE DES TRANSACTIONS
      ════════════════════════════════════════ */}
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={items}
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
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && { flex: 1 },
          ]}
        />
      )}

      {/* ════════════════════════════════════════
          FAB — Rappel groupé
      ════════════════════════════════════════ */}
      {unpaidCount > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowConfirm(true)}
          activeOpacity={0.88}
        >
          <MaterialCommunityIcons name="bell-ring" size={22} color="#FFF" />
          <Text style={styles.fabText}>Rappel groupé</Text>
        </TouchableOpacity>
      )}

      {/* ════════════════════════════════════════
          MODAL — Confirmer rappel groupé
      ════════════════════════════════════════ */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {isSendingAll ? (
              <>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
                <Text style={styles.modalTitle}>Envoi en cours…</Text>
              </>
            ) : (
              <>
                <View style={styles.modalIconWrap}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={36} color={Colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Rappel groupé</Text>
                <Text style={styles.modalMsg}>
                  Envoyer un rappel à tous les membres qui n'ont pas payé ?{'\n'}
                  <Text style={styles.modalCount}>({unpaidCount} membre{unpaidCount > 1 ? 's' : ''})</Text>
                </Text>
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalBtnCancel}
                    onPress={() => setShowConfirm(false)}
                  >
                    <Text style={styles.modalBtnCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalBtnConfirm}
                    onPress={handleRemindAll}
                  >
                    <MaterialCommunityIcons name="send" size={16} color="#FFF" />
                    <Text style={styles.modalBtnConfirmText}>Envoyer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════
          ACTION BOTTOM SHEET
      ════════════════════════════════════════ */}
      {actionItem && (
        <ActionBottomSheet
          item={actionItem}
          onClose={() => setActionItem(null)}
          onRemind={handleRemind}
          onNavigateProfile={handleNavigateProfile}
          navigation={navigation}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // ── Hors-ligne ──
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.offline,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  offlineText: { fontFamily: Fonts.body, fontSize: 12, color: '#795501' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
    shadowColor: Colors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.onSurface,
    letterSpacing: -0.3,
  },

  // ── Sélecteur de mois ──
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  monthArrow: {
    width: 30, height: 30,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.full,
  },
  monthLabel: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
    paddingHorizontal: 4,
  },

  // ── Filtres ──
  filtersScroll: {
    backgroundColor: Colors.surface,
    maxHeight: 52,
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Bandeau synthèse ──
  summaryBanner: {
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    ...Shadow.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  summaryLeft: { gap: 2 },
  summaryCollected: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  summaryCurrency: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.primaryContainer,
  },
  summaryExpected: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  pctBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  pctText: {
    fontFamily: Fonts.display,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  progressWrap: { marginTop: 4 },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statChip: { alignItems: 'center', gap: 2 },
  statCount: {
    fontFamily: Fonts.headline,
    fontSize: 18,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },

  // ── Liste ──
  list: { flex: 1 },
  listContent: {
    paddingBottom: 100, // espace FAB
  },

  // ── Footer liste ──
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerEnd: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  footerEndText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // ── État vide ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  clearFiltersBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  clearFiltersBtnText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },

  // ── Skeletons ──
  skeletonWrap: { paddingTop: 8 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  skeletonAvatar: {
    width: 42, height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  skeletonLines: { flex: 1, gap: 4 },
  skeletonLine: {
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceContainerHigh,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Radius.full,
    shadowColor: Colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Modal confirm ──
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  modalIconWrap: {
    width: 64, height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  modalMsg: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalCount: {
    fontFamily: Fonts.headline,
    color: Colors.primary,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontFamily: Fonts.title,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  modalBtnConfirm: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnConfirmText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Bottom Sheet ──
  sheetOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Shadow.fab,
  },
  sheetHandle: {
    width: 36, height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
  },
  sheetMemberName: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  sheetStatus: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  sheetActionIcon: {
    width: 40, height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetActionText: { flex: 1 },
  sheetActionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
  },
  sheetActionSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.lg,
  },
  errorMsg: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onErrorContainer,
    lineHeight: 18,
  },
  sheetCloseBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
  },
  sheetCloseBtnText: {
    fontFamily: Fonts.title,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
});

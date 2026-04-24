/**
 * SCR-008 — Suivi des Paiements (Vue Administrateur)
 * AdminPaymentTrackingScreen.tsx
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Platform,
  Linking,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from '../../components/common/ProgressBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { OPERATORS } from '../../constants/operators';
import {
  fetchGroupContributions,
  sendMemberReminder,
  sendGroupRemindAll,
  type ContributionItem,
  type ContributionFilter,
  type ContributionSummary,
} from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

type FilterOption = {
  key: ContributionFilter;
  label: string;
  countKey: keyof ContributionSummary | null;
};

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'Tous', countKey: null },
  { key: 'PAYE', label: 'Payés', countKey: 'paidCount' },
  { key: 'EN_ATTENTE', label: 'En attente', countKey: 'pendingCount' },
  { key: 'EN_RETARD', label: 'En retard', countKey: 'lateCount' },
  { key: 'ECHEC', label: 'Échecs', countKey: 'failedCount' },
];

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function formatContributionDate(iso?: string): string {
  if (!iso) return 'Date indisponible';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getOperatorMeta(operator?: string) {
  return OPERATORS.find((item) => item.id === operator);
}

function getStatusTone(status: ContributionItem['status']) {
  switch (status) {
    case 'PAYE':
      return { backgroundColor: Colors.secondaryContainer, borderColor: Colors.secondary + '25', textColor: Colors.onSecondaryContainer };
    case 'EN_RETARD':
      return { backgroundColor: Colors.errorContainer, borderColor: Colors.error + '20', textColor: Colors.onErrorContainer };
    case 'ECHEC':
      return { backgroundColor: Colors.errorContainer, borderColor: Colors.error + '18', textColor: Colors.error };
    default:
      return { backgroundColor: Colors.surfaceContainerHigh, borderColor: Colors.outlineVariant, textColor: Colors.onSurfaceVariant };
  }
}

function OfflineBannerLocal() {
  return (
    <View style={styles.offlineBanner}>
      <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
      <Text style={styles.offlineText}>Mode hors-ligne — données locales</Text>
    </View>
  );
}

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

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

interface ActionSheetProps {
  item: ContributionItem;
  onClose: () => void;
  onRemind: (item: ContributionItem) => void;
  onNavigateProfile: (item: ContributionItem) => void;
  navigation: any;
}

function ActionBottomSheet({ item, onClose, onRemind, onNavigateProfile }: ActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, [slideAnim]);

  const close = (callback?: () => void) => {
    Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
      callback?.();
    });
  };

  const statusLabel: Record<string, string> = {
    PAYE: 'Payé',
    EN_ATTENTE: 'En attente',
    EN_RETARD: 'En retard',
    ECHEC: 'Échec',
    PARTIEL: 'Partiel',
  };

  return (
    <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => close()}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={1}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetMemberName}>{item.memberName}</Text>
            <Text style={styles.sheetStatus}>{statusLabel[item.status] ?? item.status}</Text>
          </View>

          {(item.status === 'EN_ATTENTE' || item.status === 'EN_RETARD') && (
            <>
              <TouchableOpacity style={styles.sheetAction} onPress={() => close(() => onRemind(item))}>
                <View style={[styles.sheetActionIcon, { backgroundColor: Colors.secondaryContainer }]}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color={Colors.secondary} />
                </View>
                <View style={styles.sheetActionText}>
                  <Text style={styles.sheetActionTitle}>Envoyer un rappel</Text>
                  <Text style={styles.sheetActionSub}>Notification push au membre</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetAction} onPress={() => close(() => onNavigateProfile(item))}>
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

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => close()}>
            <Text style={styles.sheetCloseBtnText}>Fermer</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ContributionCard({ item, onPress }: { item: ContributionItem; onPress: () => void }) {
  const operator = getOperatorMeta(item.operator);
  const tone = getStatusTone(item.status);
  return (
    <TouchableOpacity style={styles.contributionCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdentity}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>
              {(item.memberName ?? '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardIdentityText}>
            <Text style={styles.cardMemberName} numberOfLines={1}>{item.memberName}</Text>
            <Text style={styles.cardMetaText} numberOfLines={1}>{formatContributionDate(item.paidAt)}</Text>
          </View>
        </View>
        <View style={[styles.operatorPill, operator ? { backgroundColor: operator.color + '18' } : null]}>
          <View style={[styles.operatorDot, { backgroundColor: operator?.color ?? Colors.outline }]} />
          <Text style={styles.operatorPillText} numberOfLines={1}>{operator?.name ?? 'Opérateur'}</Text>
        </View>
      </View>

      <View style={styles.cardAmountRow}>
        <View>
          <Text style={styles.cardAmountValue}>
            {item.amount.toLocaleString('fr-FR')} <Text style={styles.cardAmountCurrency}>{item.currency}</Text>
          </Text>
          <Text style={styles.cardReference} numberOfLines={1}>{item.txReference}</Text>
        </View>
        <StatusBadge status={item.status as any} size="md" />
      </View>

      {(item.status === 'EN_ATTENTE' || item.status === 'EN_RETARD' || item.status === 'ECHEC') && (
        <View style={[styles.cardStatusHint, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
          <MaterialCommunityIcons name={item.status === 'ECHEC' ? 'alert-circle-outline' : 'bell-ring-outline'} size={16} color={tone.textColor} />
          <Text style={[styles.cardStatusHintText, { color: tone.textColor }]} numberOfLines={2}>
            {item.status === 'ECHEC'
              ? (item.errorMessage ?? 'Paiement échoué, vérifier le détail.')
              : 'Touchez la carte pour afficher les actions disponibles.'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DesktopContributionRow({ item, onPress }: { item: ContributionItem; onPress: () => void }) {
  const operator = getOperatorMeta(item.operator);
  return (
    <TouchableOpacity style={styles.desktopRow} activeOpacity={0.82} onPress={onPress}>
      <View style={styles.desktopMemberCol}>
        <Text style={styles.desktopMemberName} numberOfLines={1}>{item.memberName}</Text>
        <Text style={styles.desktopSubtle} numberOfLines={1}>{item.txReference}</Text>
      </View>
      <Text style={styles.desktopCell}>{formatContributionDate(item.paidAt)}</Text>
      <Text style={styles.desktopCell} numberOfLines={1}>{operator?.name ?? 'Opérateur'}</Text>
      <Text style={[styles.desktopAmount, item.status === 'PAYE' && { color: Colors.secondary }]}>
        {item.amount.toLocaleString('fr-FR')} {item.currency}
      </Text>
      <View style={styles.desktopStatusCell}>
        <StatusBadge status={item.status as any} size="md" />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminPaymentTrackingScreen({ navigation }: any) {
  const groupId = useAuthStore(s => s.groupId);
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1024;

  const [selectedMonth, setSelectedMonth] = useState<string>(toYearMonth(new Date()));
  const [activeFilter, setActiveFilter] = useState<ContributionFilter>('all');
  const [items, setItems] = useState<ContributionItem[]>([]);
  const [summary, setSummary] = useState<ContributionSummary>({
    collectedAmount: 0,
    expectedAmount: 0,
    totalMembers: 0,
    paidCount: 0,
    pendingCount: 0,
    lateCount: 0,
    failedCount: 0,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [actionItem, setActionItem] = useState<ContributionItem | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);

  const unpaidCount = summary.pendingCount + summary.lateCount;

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  const loadContributions = useCallback(async (
    p: number,
    filter: ContributionFilter,
    month: string,
    append = false,
  ) => {
    if (!groupId) return;
    try {
      if (p === 1) setIsLoading(true);
      else setIsLoadingMore(true);

      const result = await fetchGroupContributions(groupId, month, filter, p);
      setItems(prev => (append ? [...prev, ...result.items] : result.items));
      setSummary(result.summary);
      setHasMore(result.hasMore);
      setPage(result.page);
    } catch {
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

  useEffect(() => {
    setPage(1);
    setItems([]);
    loadContributions(1, activeFilter, selectedMonth);
  }, [activeFilter, selectedMonth, loadContributions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadContributions(1, activeFilter, selectedMonth);
  }, [activeFilter, selectedMonth, loadContributions]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadContributions(page + 1, activeFilter, selectedMonth, true);
    }
  }, [hasMore, isLoadingMore, page, activeFilter, selectedMonth, loadContributions]);

  const navigateMonth = (dir: -1 | 1) => {
    const current = parseYearMonth(selectedMonth);
    current.setMonth(current.getMonth() + dir);
    setSelectedMonth(toYearMonth(current));
  };

  const displayMonth = () => {
    const d = parseYearMonth(selectedMonth);
    return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handleRowPress = (item: ContributionItem) => {
    if (item.status === 'PAYE') navigation.navigate('Receipt', { txId: item.txReference, receiptData: item });
    else setActionItem(item);
  };

  const handleRemind = async (item: ContributionItem) => {
    try {
      await sendMemberReminder(item.memberId);
      Toast.show({ type: 'success', text1: 'Rappel envoyé', text2: `${item.memberName} a été notifié(e).` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Le rappel n\'a pas pu être envoyé.' });
    }
  };

  const handleNavigateProfile = (item: ContributionItem) => {
    navigation.navigate('MemberProfile', { memberId: item.memberId });
  };

  const handleRemindAll = async () => {
    if (!groupId) return;
    setIsSendingAll(true);
    try {
      await sendGroupRemindAll(groupId);
      setShowConfirm(false);
      Toast.show({ type: 'success', text1: 'Rappels envoyés', text2: `${unpaidCount} membre(s) notifié(s).` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Les rappels n\'ont pas pu être envoyés.' });
    } finally {
      setIsSendingAll(false);
    }
  };

  const clearFilters = () => {
    setActiveFilter('all');
    setSelectedMonth(toYearMonth(new Date()));
  };

  const pct = summary.expectedAmount > 0 ? Math.round((summary.collectedAmount / summary.expectedAmount) * 100) : 0;
  const progressColor = pct >= 90 ? Colors.secondary : pct >= 50 ? Colors.tertiary : Colors.warning;
  const statsData = [
    { label: 'Payés', count: summary.paidCount, color: Colors.secondary },
    { label: 'En attente', count: summary.pendingCount, color: Colors.warning },
    { label: 'En retard', count: summary.lateCount, color: Colors.error },
    { label: 'Échecs', count: summary.failedCount, color: Colors.tertiary },
  ];

  const renderItem = ({ item }: { item: ContributionItem }) => (
    isLargeScreen
      ? <DesktopContributionRow item={item} onPress={() => handleRowPress(item)} />
      : <ContributionCard item={item} onPress={() => handleRowPress(item)} />
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return <View style={styles.footerLoader}><ActivityIndicator size="small" color={Colors.primary} /></View>;
    }
    if (!hasMore && items.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <MaterialCommunityIcons name="check-all" size={16} color={Colors.textMuted} />
          <Text style={styles.footerEndText}>Toutes les contributions sont affichées</Text>
        </View>
      );
    }
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

  const renderTableHeader = () => {
    if (!isLargeScreen || items.length === 0) return null;
    return (
      <View style={styles.desktopTableHeader}>
        <Text style={[styles.desktopHeaderText, styles.desktopMemberCol]}>Membre</Text>
        <Text style={styles.desktopHeaderText}>Date</Text>
        <Text style={styles.desktopHeaderText}>Opérateur</Text>
        <Text style={[styles.desktopHeaderText, styles.desktopAmountHeader]}>Montant</Text>
        <Text style={[styles.desktopHeaderText, styles.desktopStatusHeader]}>Statut</Text>
      </View>
    );
  };

  const renderScreenHeader = () => (
    <>
      {isOffline && <OfflineBannerLocal />}
      <View style={styles.headerShell}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Text style={styles.topBarEyebrow}>Contributions</Text>
            <Text style={styles.topBarTitle}>Suivi des paiements</Text>
            <Text style={styles.topBarSubtitle}>Vue administrateur avec rappels, filtres et statut de collecte.</Text>
          </View>
          <View style={styles.monthSelector}>
            <TouchableOpacity style={styles.monthArrow} onPress={() => navigateMonth(-1)} activeOpacity={0.8}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{displayMonth()}</Text>
            <TouchableOpacity style={styles.monthArrow} onPress={() => navigateMonth(1)} activeOpacity={0.8}>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.filtersSection}>
          <Text style={styles.filtersLabel}>Filtres rapides</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
            {FILTER_OPTIONS.map(opt => {
              const isActive = activeFilter === opt.key;
              const count = opt.countKey ? (summary[opt.countKey] as number) : summary.totalMembers;
              return (
                <TouchableOpacity key={opt.key} style={[styles.filterChip, isActive && styles.filterChipActive]} onPress={() => setActiveFilter(opt.key)} activeOpacity={0.8}>
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {opt.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
      <View style={styles.summaryBanner}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryCollected}>{summary.collectedAmount.toLocaleString('fr-FR')}<Text style={styles.summaryCurrency}> CDF</Text></Text>
            <Text style={styles.summaryExpected}>/ {summary.expectedAmount.toLocaleString('fr-FR')} CDF attendus</Text>
          </View>
          <View style={[styles.pctBadge, { backgroundColor: progressColor + '18' }]}>
            <Text style={[styles.pctText, { color: progressColor }]}>{pct}%</Text>
          </View>
        </View>
        <View style={styles.progressWrap}>
          <ProgressBar current={pct} total={100} color={progressColor} height={6} />
        </View>
        <View style={styles.summaryStatsGrid}>
          {statsData.map(s => (
            <View key={s.label} style={[styles.statCard, isLargeScreen && styles.statCardLarge]}>
              <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {renderScreenHeader()}
      {!isLoading && renderTableHeader()}

      {isLoading ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.loadingScrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          key={isLargeScreen ? 'desktop-contributions' : 'mobile-contributions'}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            isLargeScreen ? styles.listContentDesktop : styles.listContentMobile,
            items.length === 0 && { flex: 1 },
          ]}
        />
      )}

      {unpaidCount > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowConfirm(true)} activeOpacity={0.88}>
          <MaterialCommunityIcons name="bell-ring" size={22} color="#FFF" />
          <Text style={styles.fabText}>Rappel groupé</Text>
        </TouchableOpacity>
      )}

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
                  Envoyer un rappel à tous les membres qui n&apos;ont pas payé ?{`\n`}
                  <Text style={styles.modalCount}>({unpaidCount} membre{unpaidCount > 1 ? 's' : ''})</Text>
                </Text>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowConfirm(false)}>
                    <Text style={styles.modalBtnCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleRemindAll}>
                    <MaterialCommunityIcons name="send" size={16} color="#FFF" />
                    <Text style={styles.modalBtnConfirmText}>Envoyer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      )}

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
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // â”€â”€ Hors-ligne â”€â”€
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.offline,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  offlineText: { fontFamily: Fonts.body, fontSize: 12, color: '#795501' },

  // â”€â”€ Top App Bar (rÃ©fÃ©rence AdminDashboard) â”€â”€
  headerShell: {
    marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 16,
    ...Shadow.card,
  },
  topBarLeft: {
    flex: 1,
    gap: 4,
  },
  topBarEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.primaryContainer,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  topBarTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.onSurface,
    letterSpacing: -0.4,
  },
  topBarSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
    maxWidth: 520,
  },

  // â”€â”€ SÃ©lecteur de mois â”€â”€
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 2,
  },
  monthArrow: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  monthLabel: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
    minWidth: 108,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  // â”€â”€ Filtres â”€â”€
  filtersSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  filtersLabel: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  filtersScroll: {
    backgroundColor: 'transparent',
    maxHeight: 56,
  },
  filtersContent: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerHighest,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // â”€â”€ Bandeau synthÃ¨se â”€â”€
  summaryBanner: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 18,
    gap: 14,
    ...Shadow.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryLeft: { gap: 4, flex: 1 },
  summaryCollected: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.primary,
    letterSpacing: -0.6,
  },
  summaryCurrency: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.primaryContainer,
  },
  summaryExpected: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  pctBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    minHeight: 40,
    justifyContent: 'center',
  },
  pctText: {
    fontFamily: Fonts.display,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  progressWrap: { marginTop: 2 },
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statCard: {
    width: '48%',
    minHeight: 76,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '70',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 4,
  },
  statCardLarge: {
    width: '23.5%',
  },
  statCount: {
    fontFamily: Fonts.headline,
    fontSize: 20,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },

  // â”€â”€ Liste â”€â”€
  list: { flex: 1 },
  listContent: {
    paddingBottom: 128,
  },
  listContentMobile: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingScrollContent: {
    paddingBottom: 128,
  },
  listContentDesktop: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  contributionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '55',
    padding: 16,
    minHeight: 148,
    gap: 14,
    marginBottom: 12,
    ...Shadow.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.primary,
  },
  cardIdentityText: {
    flex: 1,
    gap: 4,
  },
  cardMemberName: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
  },
  cardMetaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  operatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '48%',
  },
  operatorDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  operatorPillText: {
    flexShrink: 1,
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  cardAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  cardAmountValue: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.primary,
    letterSpacing: -0.4,
  },
  cardAmountCurrency: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  cardReference: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  cardStatusHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 10,
  },
  cardStatusHintText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  desktopTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  desktopHeaderText: {
    flex: 1,
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  desktopMemberCol: {
    flex: 1.6,
  },
  desktopAmountHeader: {
    flex: 1.1,
    textAlign: 'right',
  },
  desktopStatusHeader: {
    flex: 1.2,
    textAlign: 'right',
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '45',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    gap: 12,
  },
  desktopMemberName: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
  },
  desktopSubtle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  desktopCell: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  desktopAmount: {
    flex: 1.1,
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    textAlign: 'right',
  },
  desktopStatusCell: {
    flex: 1.2,
    alignItems: 'flex-end',
  },

  // â”€â”€ Footer liste â”€â”€
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

  // â”€â”€ Ã‰tat vide â”€â”€
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 24,
    paddingVertical: 48,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadow.card,
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
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearFiltersBtnText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },

  // â”€â”€ Skeletons â”€â”€
  skeletonWrap: { paddingTop: 8, paddingHorizontal: 16 },
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

  // â”€â”€ FAB â”€â”€
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
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

  // â”€â”€ Modal confirm â”€â”€
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
    minHeight: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 44,
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

  // â”€â”€ Bottom Sheet â”€â”€
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
    minHeight: 56,
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
    minHeight: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: {
    fontFamily: Fonts.title,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
});





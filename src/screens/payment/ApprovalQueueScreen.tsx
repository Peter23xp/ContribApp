import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OfflineBanner } from '../../components/common/OfflineBanner';

type ApprovalTab = 'pending' | 'approved' | 'rejected';

type ContributionRecord = {
  id: string;
  groupId: string;
  memberName: string;
  periodMonth: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  captureImageUrl?: string | null;
  rejectionReason?: string | null;
  confidence: number;
  detectedAmount: number | null;
  submittedAt?: number;
  processedAt?: number;
};

function toMillis(value: any): number {
  if (!value) {
    return 0;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status?: string | null): ApprovalTab | 'other' {
  const normalized = (status ?? '').toString().trim().toLowerCase();

  if (['pending_approval', 'pending', 'en_attente', 'submitted'].includes(normalized)) {
    return 'pending';
  }

  if (['paid', 'paye', 'approved', 'approuve'].includes(normalized)) {
    return 'approved';
  }

  if (['rejected', 'failed', 'echec', 'rejete'].includes(normalized)) {
    return 'rejected';
  }

  return 'other';
}

function mapContributionDoc(docId: string, raw: any): ContributionRecord {
  return {
    id: docId,
    groupId: raw.group_id ?? raw.groupId ?? '',
    memberName: raw.member_name ?? raw.memberName ?? 'Membre inconnu',
    periodMonth: raw.period_month ?? raw.periodMonth ?? '-',
    amountDue: Number(raw.amount_due ?? raw.amountDue ?? raw.amount ?? 0),
    amountPaid: Number(raw.amount_paid ?? raw.amountPaid ?? raw.amount ?? 0),
    status: normalizeStatus(raw.status),
    captureImageUrl: raw.capture_image_url ?? raw.captureImageUrl ?? null,
    rejectionReason: raw.rejection_reason ?? raw.rejectionReason ?? null,
    confidence: Number(raw.gemini_analysis?.confidence ?? raw.geminiAnalysis?.confidence ?? 0),
    detectedAmount: raw.gemini_analysis?.amount ?? raw.geminiAnalysis?.amount ?? null,
    submittedAt: toMillis(raw.created_at ?? raw.submittedAt ?? raw.updated_at),
    processedAt: toMillis(raw.approved_at ?? raw.paid_at ?? raw.rejected_at ?? raw.updated_at),
  };
}

const TAB_CONFIG: { key: ApprovalTab; label: string; icon: any; activeColor: string }[] = [
  { key: 'pending',  label: 'En attente',  icon: 'time-outline',         activeColor: Colors.statusPending },
  { key: 'approved', label: 'Approuvées',  icon: 'checkmark-circle-outline', activeColor: Colors.statusPaid },
  { key: 'rejected', label: 'Rejetées',    icon: 'close-circle-outline', activeColor: Colors.error },
];

export function ApprovalQueueScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const groupId = useAuthStore((s) => s.groupId);
  const role = useAuthStore((s) => s.role);

  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');
  const [allItems, setAllItems] = useState<ContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      setAllItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, 'contributions'), where('group_id', '==', groupId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => mapContributionDoc(doc.id, doc.data()))
          .filter((item) => !!item.groupId);

        setAllItems(rows);
        setLoading(false);
        setRefreshing(false);
      },
      (snapshotError) => {
        console.error('[ApprovalQueue] snapshot error:', snapshotError);
        setError("Impossible de charger les contributions pour le moment.");
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [groupId]);

  const grouped = useMemo(() => {
    const pending = allItems
      .filter((item) => item.status === 'pending')
      .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
    const approved = allItems
      .filter((item) => item.status === 'approved')
      .sort((a, b) => (b.processedAt ?? 0) - (a.processedAt ?? 0));
    const rejected = allItems
      .filter((item) => item.status === 'rejected')
      .sort((a, b) => (b.processedAt ?? 0) - (a.processedAt ?? 0));

    return { pending, approved, rejected };
  }, [allItems]);

  const currentItems = grouped[activeTab];
  const pendingCount = grouped.pending.length;
  const approvedCount = grouped.approved.length;
  const rejectedCount = grouped.rejected.length;
  const totalDetected = grouped.pending.reduce((sum, item) => sum + Number(item.detectedAmount ?? 0), 0);
  const totalApproved = grouped.approved.reduce((sum, item) => sum + Number(item.amountPaid ?? 0), 0);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const renderItem = ({ item }: { item: ContributionRecord }) => {
    const isPending = activeTab === 'pending';
    const isMatch = item.detectedAmount != null && item.detectedAmount === item.amountDue;
    const confidenceColor = item.confidence >= 85 ? Colors.statusPaid : item.confidence >= 60 ? Colors.statusPending : Colors.error;
    const initials = item.memberName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ReviewCapture', { contributionId: item.id, readOnly: !isPending })}
      >
        {/* Left accent bar by status */}
        <View style={[styles.cardAccent, {
          backgroundColor: activeTab === 'approved' ? Colors.statusPaid : activeTab === 'rejected' ? Colors.error : Colors.statusPending,
        }]} />

        <View style={styles.cardBody}>
          {/* Member Avatar + Info Row */}
          <View style={styles.cardTopRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{initials}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.memberName}</Text>
              <Text style={styles.periodText}>Contribution {item.periodMonth}</Text>
            </View>
            {item.captureImageUrl ? (
              <Image source={{ uri: item.captureImageUrl }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
              </View>
            )}
          </View>

          {/* Amount / Status Row */}
          <View style={styles.cardDivider} />

          {isPending ? (
            <View style={styles.pendingDetails}>
              <View style={styles.amountComparison}>
                <View style={styles.amountBlock}>
                  <Text style={styles.amountBlockLabel}>Attendu</Text>
                  <Text style={styles.amountBlockValue}>{item.amountDue.toLocaleString('fr-FR')} <Text style={styles.amountBlockUnit}>CDF</Text></Text>
                </View>
                <View style={[styles.matchIndicator, { backgroundColor: isMatch ? Colors.statusPaid + '18' : Colors.statusPending + '18' }]}>
                  <Ionicons name={isMatch ? 'checkmark' : 'arrow-forward'} size={14} color={isMatch ? Colors.statusPaid : Colors.statusPending} />
                </View>
                <View style={styles.amountBlock}>
                  <Text style={styles.amountBlockLabel}>Détecté IA</Text>
                  <Text style={[styles.amountBlockValue, { color: isMatch ? Colors.statusPaid : Colors.statusPending }]}>
                    {item.detectedAmount != null ? item.detectedAmount.toLocaleString('fr-FR') : '?'} <Text style={styles.amountBlockUnit}>CDF</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceTrack}>
                  <View style={[styles.confidenceFill, { width: `${Math.min(item.confidence, 100)}%` as any, backgroundColor: confidenceColor }]} />
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '18' }]}>
                  <Text style={[styles.confidenceText, { color: confidenceColor }]}>IA {Math.round(item.confidence)}%</Text>
                </View>
              </View>
            </View>
          ) : activeTab === 'approved' ? (
            <View style={styles.resolvedRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.statusPaid} />
              <Text style={[styles.resolvedText, { color: Colors.statusPaid }]}>
                Approuvé · {item.amountPaid.toLocaleString('fr-FR')} CDF
              </Text>
            </View>
          ) : (
            <View style={styles.resolvedRow}>
              <Ionicons name="close-circle" size={16} color={Colors.error} />
              <Text style={[styles.resolvedText, { color: Colors.error }]}>
                Rejeté · {item.rejectionReason || 'Raison non précisée'}
              </Text>
            </View>
          )}

          {/* Tap hint */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterHint}>Appuyer pour {isPending ? 'examiner' : 'voir les détails'}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    if (!groupId && role === 'treasurer') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.warning} />
          </View>
          <Text style={styles.emptyTitle}>Aucun groupe actif</Text>
          <Text style={styles.emptyText}>Associez d'abord ce compte trésorier à un groupe pour voir les contributions.</Text>
        </View>
      );
    }

    const emptyConfig = {
      pending:  { icon: 'checkmark-done-circle-outline', color: Colors.statusPaid,    title: 'Aucune capture en attente',       sub: 'Les nouvelles soumissions apparaîtront ici automatiquement.' },
      approved: { icon: 'checkmark-circle-outline',      color: Colors.statusPaid,    title: 'Aucune contribution approuvée',    sub: 'Les contributions validées apparaîtront ici.' },
      rejected: { icon: 'close-circle-outline',          color: Colors.error,         title: 'Aucune contribution rejetée',      sub: 'Les contributions rejetées apparaîtront ici.' },
    }[activeTab];

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconWrap, { backgroundColor: emptyConfig.color + '12' }]}>
          <Ionicons name={emptyConfig.icon as any} size={36} color={emptyConfig.color} />
        </View>
        <Text style={styles.emptyTitle}>{emptyConfig.title}</Text>
        <Text style={styles.emptyText}>{emptyConfig.sub}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Header Banner ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEyebrow}>Trésorière · Validation</Text>
          <Text style={styles.headerTitle}>File d'approbation</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeCount}>{pendingCount}</Text>
            <Text style={styles.urgentBadgeLabel}>urgent{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <OfflineBanner />

      {/* ── Summary Stats Strip ── */}
      <View style={styles.statsStrip}>
        <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: Colors.outlineVariant + '40' }]}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>En attente</Text>
          <Text style={styles.statHint}>{totalDetected.toLocaleString('fr-FR')} CDF détectés</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.statusPaid }]}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approuvées</Text>
          <Text style={styles.statHint}>{totalApproved.toLocaleString('fr-FR')} CDF validés</Text>
        </View>
        <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: Colors.outlineVariant + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.error }]}>{rejectedCount}</Text>
          <Text style={styles.statLabel}>Rejetées</Text>
          <Text style={styles.statHint}>ce mois</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map(tab => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'pending' ? pendingCount : tab.key === 'approved' ? approvedCount : rejectedCount;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && { borderBottomWidth: 2.5, borderBottomColor: tab.activeColor }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <View style={styles.tabItemInner}>
                <Ionicons name={tab.icon} size={15} color={isActive ? tab.activeColor : Colors.textMuted} />
                <Text style={[styles.tabLabel, isActive && { color: tab.activeColor }]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={[styles.tabCountPill, { backgroundColor: isActive ? tab.activeColor + '18' : Colors.surfaceContainerLow }]}>
                    <Text style={[styles.tabCountText, { color: isActive ? tab.activeColor : Colors.textMuted }]}>{count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Chargement des contributions…</Text>
        </View>
      ) : (
        <FlatList
          data={currentItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Header ──
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  urgentBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  urgentBadgeCount: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: '#FFF',
    lineHeight: 26,
  },
  urgentBadgeLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Stats Strip ──
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.onSurface,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statHint: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  tabCountText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Loader ──
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  listContent: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
    gap: 12,
  },

  // ── Contribution Card ──
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadow.card,
  },
  cardAccent: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.gold + '40',
    flexShrink: 0,
  },
  memberAvatarText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  periodText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    borderStyle: 'dashed',
  },

  cardDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant + '40',
    marginBottom: 12,
  },

  // ── Pending Details ──
  pendingDetails: {
    gap: 10,
  },
  amountComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amountBlock: {
    flex: 1,
  },
  amountBlockLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  amountBlockValue: {
    fontFamily: Fonts.display,
    fontSize: 15,
    color: Colors.onSurface,
  },
  amountBlockUnit: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  matchIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confidenceTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  confidenceText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Resolved Rows ──
  resolvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  resolvedText: {
    fontFamily: Fonts.headline,
    fontSize: 13,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '30',
  },
  cardFooterHint: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Error Banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorContainer,
    padding: 12,
    borderRadius: Radius.lg,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: Colors.onErrorContainer,
    fontFamily: Fonts.body,
    lineHeight: 18,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});

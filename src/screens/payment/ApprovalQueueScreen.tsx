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
import { collection, onSnapshot } from 'firebase/firestore';
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
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      collection(db, 'contributions'),
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => mapContributionDoc(doc.id, doc.data()))
          .filter((item) => !!item.groupId && (!groupId || item.groupId === groupId));

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

  const onRefresh = () => {
    setRefreshing(true);
  };

  const renderItem = ({ item }: { item: ContributionRecord }) => {
    const isPending = activeTab === 'pending';
    const isMatch = item.detectedAmount != null && item.detectedAmount === item.amountDue;
    const confidenceColor = item.confidence >= 85 ? Colors.statusPaid : item.confidence >= 60 ? Colors.statusPending : Colors.error;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ReviewCapture', { contributionId: item.id, readOnly: !isPending })}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardText}>
            <Text style={styles.memberName}>{item.memberName}</Text>
            <Text style={styles.periodText}>Contribution {item.periodMonth}</Text>

            {isPending ? (
              <>
                <View style={styles.amountsRow}>
                  <Text style={styles.amountDueText}>Attendu: {item.amountDue.toLocaleString('fr-FR')} CDF</Text>
                  <Text style={[styles.amountDetectedText, { color: isMatch ? Colors.statusPaid : Colors.statusPending }]}>
                    Detecte: {item.detectedAmount != null ? item.detectedAmount.toLocaleString('fr-FR') : '?'} CDF
                  </Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}20` }]}>
                  <Text style={[styles.confidenceText, { color: confidenceColor }]}>IA: {Math.round(item.confidence)}%</Text>
                </View>
              </>
            ) : activeTab === 'approved' ? (
              <Text style={styles.approvedText}>Approuve: {item.amountPaid.toLocaleString('fr-FR')} CDF</Text>
            ) : (
              <Text style={styles.rejectedText}>Raison: {item.rejectionReason || 'Non precisee'}</Text>
            )}
          </View>

          {item.captureImageUrl ? <Image source={{ uri: item.captureImageUrl }} style={styles.thumbnail} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return null;
    }

    if (!groupId && role === 'treasurer') {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={46} color={Colors.warning} />
          <Text style={styles.emptyTitle}>Aucun groupe actif</Text>
          <Text style={styles.emptyText}>Associez d'abord ce compte tresorier a un groupe pour voir les contributions.</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color={Colors.statusPaid} />
        <Text style={styles.emptyTitle}>
          {activeTab === 'pending' ? 'Aucune capture en attente' : activeTab === 'approved' ? 'Aucune contribution approuvee' : 'Aucune contribution rejetee'}
        </Text>
        <Text style={styles.emptyText}>Les nouvelles soumissions apparaitront ici automatiquement.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <Text style={styles.headerTitle}>Contributions a valider</Text>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      </View>

      <OfflineBanner />

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.tabActive]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>En attente ({pendingCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'approved' && styles.tabActive]} onPress={() => setActiveTab('approved')}>
          <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>Approuvees ({approvedCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'rejected' && styles.tabActive]} onPress={() => setActiveTab('rejected')}>
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>Rejetees ({rejectedCount})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  badgeCount: {
    marginLeft: 10,
    minWidth: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.headline,
    fontSize: 13,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
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
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  memberName: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
  },
  periodText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: Fonts.body,
  },
  amountsRow: {
    marginTop: 8,
    gap: 4,
  },
  amountDueText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  amountDetectedText: {
    fontSize: 12,
    fontFamily: Fonts.headline,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: Fonts.headline,
  },
  approvedText: {
    color: Colors.statusPaid,
    fontFamily: Fonts.headline,
    marginTop: 8,
  },
  rejectedText: {
    color: Colors.error,
    fontStyle: 'italic',
    marginTop: 8,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    marginLeft: 12,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
});

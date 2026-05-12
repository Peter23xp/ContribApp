import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Platform, StatusBar, Share, Modal, FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from '../../components/common/ProgressBar';
import { MemberPaymentRow } from '../../components/common/MemberPaymentRow';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import * as db from '../../services/database';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '../../config/firebase';
import { fmtDate } from '../../utils/formatDate';
import { generateGroupExcelReport } from '../../services/excelReportService';

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.goldMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.25)' }}>
      <Text style={{ fontFamily: Fonts.headline, fontSize: size * 0.36, color: Colors.primary }}>{initials}</Text>
    </View>
  );
}

export default function TreasurerDashboardScreen({ navigation }: any) {
  const user = useAuthStore(st => st.user);
  const uid = useAuthStore(st => st.uid);
  const unreadCount = useNotificationStore(st => st.unreadCount);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [reminderSentMap, setReminderSentMap] = useState<Record<string, boolean>>({});
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (!group?.id) return;
    const q = query(
      collection(firestoreDb, 'contributions'),
      where('group_id', '==', group.id),
      where('status', '==', 'pending_approval')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingApprovals(items);
    });
    return () => unsubscribe();
  }, [group?.id]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const g = await db.getGroupForMember(uid || '') ?? await db.getGroupForAdmin(uid || '');
    setGroup(g);
    if (g) {
      const [contribs, mems, recent] = await Promise.all([
        db.getContributionsForMonth(g.id),
        db.getMembersOfGroup(g.id),
        db.getRecentPaymentsForGroup(g.id, 5),
      ]);
      setContributions(contribs);
      setMembers(mems);
      setRecentPayments(recent);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );
  const handleRefresh = () => { setRefreshing(true); loadData().then(() => setRefreshing(false)); };

  const paidContribs = contributions.filter((c: any) => c.status === 'PAYE');
  const pendingContribs = contributions.filter((c: any) => c.status !== 'PAYE');
  const totalReceived = paidContribs.reduce((sum: number, c: any) => sum + c.amount, 0);

  const handleReminder = (member: any) => {
    setReminderSentMap(prev => ({ ...prev, [member.id]: true }));
    Toast.show({ type: 'success', text1: 'Rappel envoyé', text2: `Rappel envoyé à ${member.fullName}` });
    setTimeout(() => setReminderSentMap(prev => ({ ...prev, [member.id]: false })), 3000);
  };

  const availableMonths = useMemo(() => {
    const months: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
    }
    return months;
  }, []);

  const handleExportForPeriod = async (period: string) => {
    if (!group?.id) return;
    setShowPeriodPicker(false);
    setExportLoading(true);
    Toast.show({ type: 'info', text1: 'Génération du rapport…', text2: 'Veuillez patienter.' });
    try {
      await generateGroupExcelReport({ groupId: group.id, period, reportType: 'monthly' });
      Toast.show({ type: 'success', text1: 'Rapport Excel généré', text2: 'Prêt à partager ✓' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Export impossible' });
    } finally {
      setExportLoading(false);
    }
  };

  const paidPct = members.length > 0 ? paidContribs.length / members.length : 0;
  const progressBarColor = paidPct >= 0.9 ? Colors.secondary : paidPct >= 0.5 ? Colors.tertiary : Colors.warning;
  const dueDay = group?.due_day ?? 25;
  const firstName = (user?.fullName ?? 'Trésorière').split(' ')[0];
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon ap.' : 'Bonsoir';

  if (!isLoading && !group) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <View style={s.header}>
          <View style={s.headerLogoWrap}>
            <Text style={s.headerLogoLetter}>C</Text>
          </View>
          <Text style={s.headerAppName}>ContribApp</Text>
        </View>
        <View style={s.emptyBody}>
          <View style={s.emptyIconWrap}>
            <MaterialCommunityIcons name="account-group-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Aucun groupe trouvé</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerLogoWrap}>
            <Text style={s.headerLogoLetter}>C</Text>
          </View>
          <View>
            <Text style={s.headerGreeting}>{greeting}, {firstName}</Text>
            {group?.name && <Text style={s.headerGroupName}>{group.name}</Text>}
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={Colors.onSurfaceVariant} />
            {unreadCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerIconBtn, { backgroundColor: Colors.goldMuted }]}
            onPress={() => setShowPeriodPicker(true)}
            activeOpacity={0.7}
            disabled={exportLoading}
          >
            <MaterialCommunityIcons
              name={exportLoading ? 'loading' : 'file-excel-outline'}
              size={20}
              color={Colors.goldDark}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── ALERTE PRIORITAIRE : À valider ─────────────────────────── */}
        {pendingApprovals.length > 0 && (
          <TouchableOpacity
            style={s.alertBanner}
            onPress={() => navigation.navigate('ApprovalQueue')}
            activeOpacity={0.88}
          >
            <View style={s.alertBannerDot} />
            <View style={s.alertBannerIcon}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color='#FFF' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertBannerTitle}>
                {pendingApprovals.length} capture{pendingApprovals.length > 1 ? 's' : ''} à valider
              </Text>
              <Text style={s.alertBannerSub}>Appuyer pour examiner</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color='rgba(255,255,255,0.8)' />
          </TouchableOpacity>
        )}

        {/* ── 3 STATS HORIZONTALES ────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statBoxValue}>
              {isLoading ? '·' : totalReceived.toLocaleString('fr-FR')}
            </Text>
            <Text style={s.statBoxUnit}>CDF</Text>
            <Text style={s.statBoxLabel}>Reçu ce mois</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <View style={s.statFracRow}>
              <Text style={[s.statBoxValue, { fontSize: 24 }]}>{paidContribs.length}</Text>
              <Text style={s.statBoxFracSlash}>/</Text>
              <Text style={[s.statBoxValue, { fontSize: 16, color: Colors.textMuted }]}>{members.length}</Text>
            </View>
            <Text style={s.statBoxLabel}>Membres payés</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statBoxValue, { fontSize: 20, color: pendingContribs.length > 0 ? Colors.warning : Colors.secondary }]}>
              {pendingContribs.length}
            </Text>
            <Text style={s.statBoxLabel}>En attente</Text>
          </View>
        </View>

        {/* ── BARRE DE PROGRESSION + BOUTON VALIDER ────────────────────── */}
        <View style={s.progressCard}>
          <View style={s.progressCardTop}>
            <View>
              <Text style={s.progressCardTitle}>Collecte mensuelle</Text>
              <Text style={s.progressCardSub}>
                Avant le {dueDay} du mois
              </Text>
            </View>
            <Text style={[s.progressCardPct, { color: progressBarColor }]}>
              {members.length > 0 ? Math.round(paidPct * 100) : 0}%
            </Text>
          </View>
          <ProgressBar
            current={paidContribs.length}
            total={members.length || 1}
            color={progressBarColor}
            height={8}
          />
          {pendingApprovals.length > 0 && (
            <TouchableOpacity
              style={s.validateBtn}
              onPress={() => navigation.navigate('ApprovalQueue')}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="check-decagram" size={18} color="#FFF" />
              <Text style={s.validateBtnText}>
                Valider {pendingApprovals.length} paiement{pendingApprovals.length > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── MEMBRES EN ATTENTE ───────────────────────────────────────── */}
        {pendingContribs.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>En attente de paiement</Text>
              <View style={s.countPill}>
                <Text style={s.countPillText}>{pendingContribs.length}</Text>
              </View>
            </View>
            <View style={s.memberList}>
              {pendingContribs.map((c: any, i: number) => (
                <View key={c.id} style={[s.memberListItem, i > 0 && s.memberListItemBorder]}>
                  <MemberPaymentRow
                    member={{ id: c.user_id, fullName: c.full_name, phone: c.phone, paymentStatus: c.status, amount: c.amount }}
                    showReminder
                    reminderSent={reminderSentMap[c.user_id] ?? false}
                    onReminderPress={handleReminder}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── TOUT PAYÉ banner ────────────────────────────────────────── */}
        {pendingContribs.length === 0 && !isLoading && (
          <View style={s.allPaidBanner}>
            <MaterialCommunityIcons name="party-popper" size={28} color={Colors.secondary} />
            <View>
              <Text style={s.allPaidBannerTitle}>Collecte complète !</Text>
              <Text style={s.allPaidBannerSub}>Tous les membres ont payé ce mois.</Text>
            </View>
          </View>
        )}

        {/* ── DERNIERS PAIEMENTS REÇUS ─────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Derniers paiements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ApprovalQueue')}>
              <Text style={s.seeAll}>Voir tout →</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <><View style={s.skeleton} /><View style={s.skeleton} /></>
          ) : recentPayments.length === 0 ? (
            <Text style={s.emptyText}>Aucun paiement reçu ce mois.</Text>
          ) : (
            <View style={s.paymentFeed}>
              {recentPayments.map((p: any, i: number) => (
                <TouchableOpacity key={p.id} style={[s.feedItem, i > 0 && s.feedItemBorder]} activeOpacity={0.7} onPress={() => navigation.navigate('Receipt', { txId: p.id ?? '' })}>
                  <Avatar name={p.full_name ?? '?'} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.feedName}>{p.full_name}</Text>
                    <Text style={s.feedSub}>Contribution validée</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.feedAmount}>+{Math.round((p.amount ?? 0) / 1000)}k CDF</Text>
                    <Text style={s.feedTime}>
                      {fmtDate(p.paid_at, { day: '2-digit', month: '2-digit' }, 'Ce mois')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Sélecteur de période pour l'export Excel ── */}
      <Modal
        visible={showPeriodPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeriodPicker(false)}
      >
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Choisir la période</Text>
              <TouchableOpacity onPress={() => setShowPeriodPicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
            <Text style={s.pickerSub}>Sélectionnez le mois pour lequel générer le rapport Excel</Text>
            <FlatList
              data={availableMonths}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerItem}
                  onPress={() => handleExportForPeriod(item.value)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="calendar-month-outline" size={18} color={Colors.primary} />
                  <Text style={s.pickerItemText}>{item.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.pickerSeparator} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '30',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  headerLogoLetter: {
    fontFamily: Fonts.display, fontSize: 20, color: Colors.primary, lineHeight: 24,
  },
  headerGreeting: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface },
  headerGroupName: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  headerAppName: { fontFamily: Fonts.display, fontSize: 18, color: Colors.primary },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  bellBadgeText: {
    fontFamily: Fonts.label, fontSize: 9, fontWeight: '700', color: '#FFF', lineHeight: 12,
  },

  // ── Period Picker Modal ──
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, maxHeight: '75%',
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  pickerTitle: {
    fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface,
  },
  pickerSub: {
    fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginBottom: 16,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  pickerItemText: {
    fontFamily: Fonts.body, fontSize: 15, color: Colors.onSurface, flex: 1,
    textTransform: 'capitalize',
  },
  pickerSeparator: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.outlineVariant + '60',
  },

  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },

  // Alert banner — full width orange strip
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E65100',
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  alertBannerDot: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -40,
  },
  alertBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  alertBannerTitle: { fontFamily: Fonts.headline, fontSize: 14, color: '#FFF' },
  alertBannerSub: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  // 3 stats horizontal
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xxl,
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginBottom: 14,
    alignItems: 'center',
    ...Shadow.fab,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statBoxValue: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.gold,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  statBoxUnit: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(201,168,76,0.65)',
    letterSpacing: 1,
  },
  statBoxFracSlash: {
    fontFamily: Fonts.body,
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    marginHorizontal: 2,
    lineHeight: 30,
  },
  statFracRow: { flexDirection: 'row', alignItems: 'baseline' },
  statBoxLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: 'center',
  },

  // Progress card
  progressCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 20,
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  progressCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  progressCardTitle: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  progressCardSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  progressCardPct: { fontFamily: Fonts.display, fontSize: 24, letterSpacing: -0.5 },

  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    marginTop: 14,
  },
  validateBtnText: { fontFamily: Fonts.headline, fontSize: 14, color: '#FFF' },

  // Section
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 17, color: Colors.onSurface },
  seeAll: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  countPill: {
    backgroundColor: Colors.warning + '18',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.warning + '35',
  },
  countPillText: { fontFamily: Fonts.headline, fontSize: 12, color: Colors.warning },

  // Member list
  memberList: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  memberListItem: {},
  memberListItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '40',
  },

  // All paid banner
  allPaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.secondary + '10',
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.secondary + '25',
  },
  allPaidBannerTitle: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.secondary },
  allPaidBannerSub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.secondary + 'BB', marginTop: 1 },

  // Payment feed
  paymentFeed: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '40',
  },
  feedName: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  feedSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  feedAmount: { fontFamily: Fonts.headline, fontSize: 13, color: Colors.secondary },
  feedTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  skeleton: { height: 52, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, marginBottom: 8 },
  emptyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingVertical: 12, textAlign: 'center' },

  // Empty state
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
  },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, textAlign: 'center' },
});

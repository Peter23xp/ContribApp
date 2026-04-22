import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, StatusBar, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from '../../components/common/ProgressBar';
import { MemberPaymentRow } from '../../components/common/MemberPaymentRow';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';

function Avatar({ name, size = 40, bgColor }: { name: string; size?: number; bgColor?: string }) {
  const initials = (name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor ?? Colors.surfaceVariant }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export default function AdminDashboardScreen({ navigation }: any) {
  const { user, groupId: storeGroupId, role } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    let g = null;
    // Priorité au groupId du store s'il existe
    if (storeGroupId) {
      const snap = await db.getGroupById(storeGroupId);
      if (snap) g = snap;
    }
    
    // Fallback sur la recherche par admin_uid si non trouvé
    if (!g) {
      g = await db.getGroupForAdmin(user.id);
    }

    setGroup(g);
    if (g) {
      const [contribs, mems] = await Promise.all([
        db.getContributionsForMonth(g.id),
        db.getMembersOfGroup(g.id),
      ]);
      setContributions(contribs);
      setMembers(mems);
    }
    setIsLoading(false);
  }, [user, storeGroupId]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );
  const handleRefresh = () => { setRefreshing(true); loadData().then(() => setRefreshing(false)); };

  const paidContribs = contributions.filter(c => c.status === 'PAYE');
  const lateContribs = contributions.filter(c => (c.status === 'EN_ATTENTE' || c.status === 'EN_RETARD'));
  const recomputedBalance = paidContribs.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalBalance = recomputedBalance > 0 ? recomputedBalance : Number(group?.collected_amount ?? 0);
  const currency = group?.currency || 'CDF';
  const dueDate = group ? new Date(new Date().getFullYear(), new Date().getMonth(), group.payment_deadline_day ?? 25) : null;

  const handleSendReminders = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false); setShowConfirm(false);
      Toast.show({ type: 'success', text1: 'Rappels envoyés', text2: `${lateContribs.length} membre(s) notifié(s)` });
    }, 1000);
  };

  if (!isLoading && !group) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <MaterialCommunityIcons name="bank" size={22} color="#004d40" />
            <Text style={styles.topBarTitle}>ContribApp</Text>
          </View>
        </View>
        <View style={styles.emptyBody}>
          <MaterialCommunityIcons name="account-group-outline" size={64} color={Colors.outlineVariant} />
          <Text style={styles.emptyTitle}>Aucun groupe</Text>
          <Text style={styles.emptySub}>Créez votre premier groupe pour commencer.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Top App Bar ─────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <MaterialCommunityIcons name="bank" size={22} color="#004d40" />
          <Text style={styles.topBarTitle}>ContribApp</Text>
        </View>
        <TouchableOpacity style={styles.topBarBtn}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance ───────────────────────────────────────────────────── */}
        <View style={styles.balanceSection}>
          <Text style={styles.balLabel}>TOTAL GROUP BALANCE</Text>
          <View style={styles.balRow}>
            <Text style={styles.balAmount}>
              {isLoading ? '—' : totalBalance.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.balCurrency}> {currency}</Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <MaterialCommunityIcons name="check-circle" size={24} color={Colors.secondary} style={{ marginBottom: 12 }} />
              <Text style={styles.statusLabel}>YOUR STATUS</Text>
              <Text style={[styles.statusValue, { color: Colors.secondary }]}>Admin</Text>
            </View>
            <View style={styles.statusCard}>
              <MaterialCommunityIcons name="calendar-today" size={24} color={Colors.tertiary} style={{ marginBottom: 12 }} />
              <Text style={styles.statusLabel}>NEXT DEADLINE</Text>
              <Text style={[styles.statusValue, { color: Colors.onSurface }]}>
                {dueDate ? `${dueDate.getDate()} ${dueDate.toLocaleDateString('fr-FR', { month: 'short' })}` : '--'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── CTA Send Reminders ────────────────────────────────────────── */}
        <TouchableOpacity style={styles.ctaBtn} onPress={() => setShowConfirm(true)} activeOpacity={0.88}>
          <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#FFF" />
          <Text style={styles.ctaBtnText}>Send Reminders</Text>
        </TouchableOpacity>

        {/* ── Latest Activity ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Activity</Text>
            <TouchableOpacity><Text style={styles.seeAll}>View All</Text></TouchableOpacity>
          </View>
          <View style={styles.activityContainer}>
            {isLoading ? <View style={styles.skeleton} /> :
              paidContribs.length === 0 ? <Text style={styles.emptyText}>Aucun paiement ce mois.</Text> :
                paidContribs.slice(0, 3).map(c => (
                  <View key={c.id} style={styles.actItem}>
                    <View style={styles.actAvatarWrap}>
                      <Avatar name={c.full_name ?? '?'} size={48} bgColor={Colors.surfaceVariant} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actName}>{c.full_name}</Text>
                      <Text style={styles.actSub}>Paid full contribution</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.actAmount}>+{Math.round((c.amount ?? 0) / 1000)}k</Text>
                      <Text style={styles.actTime}>Ce mois</Text>
                    </View>
                  </View>
                ))
            }
          </View>
        </View>

        {/* ── Progress ──────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection Progress</Text>
          </View>
          <View style={styles.progressHeader}>
            <Text style={styles.progressFraction}>{paidContribs.length} <Text style={styles.progressTotal}>/ {members.length}</Text></Text>
          </View>
          <ProgressBar current={paidContribs.length} total={members.length || 1} color={Colors.secondary} height={8} />
        </View>

        {/* ── Top Members ───────────────────────────────────────────────── */}
        {members.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Top Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {members.slice(0, 5).map((m, i) => (
                <View key={m.id} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: i === 0 ? Colors.primaryFixed + '60' : Colors.surfaceContainerHigh }]}>
                    <Avatar name={m.full_name ?? '?'} size={48} bgColor="transparent" />
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {(m.full_name ?? '?').split(' ')[0]}
                  </Text>
                  <View style={[styles.memberBadge, { backgroundColor: Colors.secondary + '18' }]}>
                    <Text style={[styles.memberBadgeText, { color: Colors.secondary }]}>
                      {m.member_role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Awaiting payment ──────────────────────────────────────────── */}
        {lateContribs.length > 0 && (
          <View style={[styles.section, { marginTop: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Awaiting Payment</Text>
              <View style={styles.badgeRed}>
                <Text style={styles.badgeRedText}>{lateContribs.length}</Text>
              </View>
            </View>
            {lateContribs.slice(0, 3).map(c => (
              <MemberPaymentRow
                key={c.id}
                member={{ id: c.user_id, fullName: c.full_name, phone: c.phone, paymentStatus: 'EN_RETARD', amount: c.amount }}
                showReminder={false}
              />
            ))}
          </View>
        )}

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* FAB */}
      {lateContribs.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowConfirm(true)}>
          <MaterialCommunityIcons name="bell-ring" size={26} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Modal confirm reminders */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="bell-ring-outline" size={40} color={Colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Send Reminders?</Text>
            <Text style={styles.modalMsg}>
              A push notification will be sent to {lateContribs.length} member(s) awaiting payment.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowConfirm(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleSendReminders} disabled={sending}>
                <Text style={styles.modalBtnConfirmText}>{sending ? 'Sending...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 12,
    shadowColor: Colors.onSurface, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 20, color: '#004d40' },
  topBarBtn: { padding: 8, borderRadius: Radius.full },
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface, marginTop: 16, textAlign: 'center' },
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 6, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  balanceSection: { marginBottom: 24 },
  balLabel: { fontFamily: Fonts.label, fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant, letterSpacing: 1.2, marginBottom: 6 },
  balRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  balAmount: { fontFamily: Fonts.display, fontSize: 40, color: Colors.primary, letterSpacing: -1 },
  balCurrency: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.primaryContainer },
  statusGrid: { flexDirection: 'row', gap: 16 },
  statusCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 20, borderWidth: 1, borderColor: Colors.outlineVariant + '26', ...Shadow.card,
  },
  statusLabel: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '600', color: Colors.onSurfaceVariant, letterSpacing: 0.8, marginBottom: 4 },
  statusValue: { fontFamily: Fonts.headline, fontSize: 18 },
  ctaBtn: {
    height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 32, shadowColor: Colors.primary,
    shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  ctaBtnText: { fontFamily: Fonts.headline, fontSize: 17, color: '#FFF' },
  section: { marginBottom: 24 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 20,
    marginBottom: 24, ...Shadow.card,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface },
  seeAll: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  emptyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingVertical: 8 },
  skeleton: { height: 56, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, marginBottom: 8 },
  activityContainer: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 8, gap: 4 },
  actItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: 16, gap: 16,
  },
  actAvatarWrap: { borderRadius: 999, overflow: 'hidden', borderWidth: 2, borderColor: Colors.surface },
  actName: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  actSub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  actAmount: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.secondary },
  actTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.onSurfaceVariant },
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  progressFraction: { fontFamily: Fonts.display, fontSize: 32, color: Colors.onSurface },
  progressTotal: { fontFamily: Fonts.body, fontSize: 18, color: Colors.onSurfaceVariant },
  memberCard: {
    width: 140, backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl, padding: 16, alignItems: 'center', gap: 8,
  },
  memberAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  memberName: { fontFamily: Fonts.headline, fontSize: 12, color: Colors.onSurface },
  memberBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  memberBadgeText: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '700' },
  badgeRed: { backgroundColor: Colors.errorContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeRedText: { fontFamily: Fonts.title, fontSize: 12, color: Colors.error },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: Fonts.headline, color: Colors.primary },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.5)', justifyContent: 'center', padding: 24,
  },
  modal: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xxl, padding: 28, alignItems: 'center' },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface, marginBottom: 8 },
  modalMsg: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center' },
  modalBtnCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant },
  modalBtnConfirm: { flex: 2, padding: 14, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center' },
  modalBtnConfirmText: { fontFamily: Fonts.headline, color: '#FFF' },
});

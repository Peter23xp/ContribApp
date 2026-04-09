import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Platform, StatusBar, Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from '../../components/common/ProgressBar';
import { MemberPaymentRow } from '../../components/common/MemberPaymentRow';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: Fonts.headline, fontSize: size * 0.36, color: Colors.primary }}>{initials}</Text>
    </View>
  );
}

function TopBar() {
  return (
    <View style={s.topBar}>
      <View style={s.topBarLeft}>
        <MaterialCommunityIcons name="bank" size={22} color="#004d40" />
        <Text style={s.topBarTitle}>ContribApp</Text>
      </View>
      <TouchableOpacity style={s.topBarBtn}>
        <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

export default function TreasurerDashboardScreen({ navigation }: any) {
  const user = useAuthStore(st => st.user);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [reminderSentMap, setReminderSentMap] = useState<Record<string, boolean>>({});

  const loadData = useCallback(() => {
    if (!user) return;
    const g = db.getGroupForMember(user.id) ?? db.getGroupForAdmin(user.id);
    setGroup(g);
    if (g) {
      setContributions(db.getContributionsForMonth(g.id));
      setMembers(db.getMembersOfGroup(g.id));
      setRecentPayments(db.getRecentPaymentsForGroup(g.id, 5));
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  const handleRefresh = () => { setRefreshing(true); loadData(); setRefreshing(false); };

  const paidContribs = contributions.filter((c: any) => c.status === 'PAYE');
  const pendingContribs = contributions.filter((c: any) => c.status !== 'PAYE');
  const totalReceived = paidContribs.reduce((sum: number, c: any) => sum + c.amount, 0);

  const handleReminder = (member: any) => {
    setReminderSentMap(prev => ({ ...prev, [member.id]: true }));
    Toast.show({ type: 'success', text1: 'Rappel envoyé', text2: `Rappel envoyé à ${member.fullName}` });
    setTimeout(() => setReminderSentMap(prev => ({ ...prev, [member.id]: false })), 3000);
  };

  const handleExportPDF = async () => {
    Toast.show({ type: 'info', text1: 'Export PDF', text2: 'Génération du rapport en cours...' });
    setTimeout(async () => {
      await Share.share({ message: `ContribApp — Rapport du mois — Groupe: ${group?.name ?? ''} — Total reçu: ${totalReceived.toLocaleString('fr-FR')} CDF` });
    }, 1000);
  };

  // Couleur barre selon %
  const paidPct = members.length > 0 ? paidContribs.length / members.length : 0;
  const progressBarColor = paidPct >= 0.9 ? Colors.secondary : paidPct >= 0.5 ? Colors.tertiary : Colors.warning;

  const dueDay = group?.due_day ?? 25;
  const nextDeadline = new Date(); nextDeadline.setDate(dueDay);

  if (!isLoading && !group) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <TopBar />
        <View style={s.emptyBody}>
          <MaterialCommunityIcons name="account-group-outline" size={72} color={Colors.outlineVariant} />
          <Text style={s.emptyTitle}>Aucun groupe trouvé</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <TopBar />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance (hero) ──────────────────────────────────────────── */}
        <View style={s.balanceSection}>
          <Text style={s.balLabel}>TOTAL RECEIVED THIS MONTH</Text>
          <View style={s.balRow}>
            <Text style={s.balAmount}>
              {isLoading ? '—' : totalReceived.toLocaleString('fr-FR', { minimumFractionDigits: 3 })}
            </Text>
            <Text style={s.balCurrency}> CDF</Text>
          </View>
          <Text style={s.balSub}>
            Mes recettes — {group?.name ?? ''}
          </Text>

          {/* Status cards */}
          <View style={s.statusGrid}>
            <View style={s.statusCard}>
              <MaterialCommunityIcons name="cash-check" size={24} color={Colors.secondary} style={{ marginBottom: 12 }} />
              <Text style={s.statusLabel}>PAID STATUS</Text>
              <Text style={[s.statusValue, { color: Colors.secondary }]}>
                {paidContribs.length} / {members.length}
              </Text>
            </View>
            <View style={s.statusCard}>
              <MaterialCommunityIcons name="clock-outline" size={24} color={Colors.warning} style={{ marginBottom: 12 }} />
              <Text style={s.statusLabel}>OUTSTANDING</Text>
              <Text style={[s.statusValue, { color: pendingContribs.length > 0 ? Colors.warning : Colors.secondary }]}>
                {pendingContribs.length} await.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Export PDF Button ────────────────────────────────────────── */}
        <TouchableOpacity style={s.exportBtn} onPress={handleExportPDF} activeOpacity={0.85}>
          <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFF" />
          <Text style={s.exportBtnText}>Exporter rapport PDF</Text>
        </TouchableOpacity>

        {/* ── Widget : Solde reçu ce mois ─────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Solde reçu ce mois</Text>
          <Text style={[s.heroAmount, { color: Colors.secondary, marginTop: 4 }]}>
            {totalReceived.toLocaleString('fr-FR')} CDF
          </Text>
          <Text style={s.cardSub}>Crédité sur votre compte Airtel Money</Text>
        </View>

        {/* ── Latest Activity ──────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Derniers paiements reçus</Text>
            <TouchableOpacity><Text style={s.seeAll}>View All</Text></TouchableOpacity>
          </View>
          <View style={s.activityContainer}>
            {isLoading ? (
              <><View style={s.skeleton} /><View style={s.skeleton} /></>
            ) : recentPayments.length === 0 ? (
              <Text style={s.emptyText}>Aucun paiement reçu ce mois.</Text>
            ) : (
              recentPayments.map((p: any) => (
                <View key={p.id} style={s.actItem}>
                  <View style={s.actAvatarWrap}>
                    <Avatar name={p.full_name ?? '?'} size={48} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actName}>{p.full_name}</Text>
                    <Text style={s.actSub}>Paid full contribution</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.actAmount}>+{Math.round((p.amount ?? 0) / 1000)}k</Text>
                    <Text style={s.actTime}>
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'Ce mois'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── Progression du groupe ────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Progression ce mois</Text>
          <Text style={s.cardSub}>
            {paidContribs.length} / {members.length} membres ont payé
          </Text>
          <View style={{ marginTop: 12 }}>
            <ProgressBar
              current={paidContribs.length}
              total={members.length || 1}
              color={progressBarColor}
              height={10}
            />
          </View>
          <Text style={[s.cardSub, { marginTop: 6 }]}>
            {members.length > 0 ? Math.round(paidPct * 100) : 0}% des membres ont payé
          </Text>
        </View>

        {/* ── Membres en attente ───────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>En attente de paiement</Text>
            {pendingContribs.length > 0 && (
              <View style={s.badgeOrange}>
                <Text style={s.badgeOrangeText}>{pendingContribs.length}</Text>
              </View>
            )}
          </View>

          {pendingContribs.length === 0 ? (
            <View style={s.allPaidRow}>
              <MaterialCommunityIcons name="check-circle" size={18} color={Colors.secondary} />
              <Text style={s.allPaidText}>Tous les membres ont payé !</Text>
            </View>
          ) : (
            pendingContribs.map((c: any) => (
              <MemberPaymentRow
                key={c.id}
                member={{ id: c.user_id, fullName: c.full_name, phone: c.phone, paymentStatus: c.status, amount: c.amount }}
                showReminder
                reminderSent={reminderSentMap[c.user_id] ?? false}
                onReminderPress={handleReminder}
              />
            ))
          )}
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 12,
    shadowColor: Colors.onSurface, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 20, color: '#004d40' },
  topBarBtn: { padding: 8, borderRadius: Radius.full },
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface, marginTop: 16, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },

  balanceSection: { marginBottom: 24 },
  balLabel: { fontFamily: Fonts.label, fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant, letterSpacing: 1.2, marginBottom: 6 },
  balRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  balAmount: { fontFamily: Fonts.display, fontSize: 40, color: Colors.primary, letterSpacing: -1 },
  balCurrency: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.primaryContainer },
  balSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant, marginBottom: 20 },
  statusGrid: { flexDirection: 'row', gap: 16 },
  statusCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 20, borderWidth: 1, borderColor: Colors.outlineVariant + '26', ...Shadow.card,
  },
  statusLabel: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '600', color: Colors.onSurfaceVariant, letterSpacing: 0.8, marginBottom: 4 },
  statusValue: { fontFamily: Fonts.headline, fontSize: 18 },

  exportBtn: {
    height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 32, shadowColor: Colors.primary,
    shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  exportBtnText: { fontFamily: Fonts.headline, fontSize: 16, color: '#FFF' },

  card: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 20, marginBottom: 24, ...Shadow.card,
  },
  cardTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface, marginBottom: 4 },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant },
  heroAmount: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: -1, marginBottom: 4 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface },
  seeAll: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  emptyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingVertical: 8, textAlign: 'center' },
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

  badgeOrange: { backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  badgeOrangeText: { fontFamily: Fonts.title, fontSize: 12, color: Colors.warning },
  allPaidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  allPaidText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.secondary },
});

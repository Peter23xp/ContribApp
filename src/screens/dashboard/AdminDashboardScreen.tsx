import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, StatusBar, Platform, Share
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from '../../components/common/ProgressBar';
import { MemberPaymentRow } from '../../components/common/MemberPaymentRow';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
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
  const { user, groupId: storeGroupId, role, uid } = useAuthStore();
  const unreadCount = useNotificationStore(st => st.unreadCount);
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
    if (storeGroupId) {
      const snap = await db.getGroupById(storeGroupId);
      if (snap) g = snap;
    }

    if (!g) {
      g = await db.getGroupForAdmin(uid || '');
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
  }, [user, storeGroupId, uid]);

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
  const paidPct = members.length > 0 ? paidContribs.length / members.length : 0;

  const handleShare = async () => {
    if (!group) return;
    const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const paidCount = paidContribs.length;
    const totalCount = members.length;
    const balance = totalBalance.toLocaleString('fr-FR');
    const code = group.invite_code ?? '';
    const message =
      `📊 *${group.name}* — Rapport ${month}\n\n` +
      `✅ Cotisations reçues : ${paidCount} / ${totalCount} membres\n` +
      `💰 Solde collecté : ${balance} ${currency}\n` +
      `📅 Échéance : le ${group.payment_deadline_day ?? 25} du mois\n` +
      (code ? `\n🔗 Code d'invitation : *${code}*\n` +
      `Rejoins le groupe ici : https://contributapp.rdc/join?code=${code}` : '');
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('[AdminDashboard] Share error:', e);
    }
  };

  const handleSendReminders = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false); setShowConfirm(false);
      Toast.show({ type: 'success', text1: 'Rappels envoyés', text2: `${lateContribs.length} membre(s) notifié(s)` });
    }, 1000);
  };

  // ── Greeting ──────────────────────────────────────────────────────────────
  const firstName = (user?.fullName ?? 'Admin').split(' ')[0];
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const todayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isLoading && !group) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLogoWrap}>
            <Text style={styles.headerLogoLetter}>C</Text>
          </View>
          <Text style={styles.headerAppName}>ContribApp</Text>
        </View>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="account-group-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Aucun groupe</Text>
          <Text style={styles.emptySub}>Créez votre premier groupe pour commencer.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── HEADER : Greeting personnalisé ──────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoWrap}>
            <Text style={styles.headerLogoLetter}>C</Text>
          </View>
          <View>
            <Text style={styles.headerGreeting}>{greeting}, {firstName}</Text>
            <Text style={styles.headerDate}>{todayLabel}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={Colors.onSurfaceVariant} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: Colors.goldMuted }]} onPress={handleShare} activeOpacity={0.7}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={Colors.goldDark} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── GROUPE NAME CHIP ─────────────────────────────────────────── */}
        {group?.name && (
          <View style={styles.groupChip}>
            <MaterialCommunityIcons name="account-group" size={14} color={Colors.primary} />
            <Text style={styles.groupChipText}>{group.name}</Text>
            <View style={styles.adminChip}>
              <Text style={styles.adminChipText}>Admin</Text>
            </View>
          </View>
        )}

        {/* ── SOLDE HERO — horizontal avec accent gauche ───────────────── */}
        <View style={styles.balanceHero}>
          <View style={styles.balanceHeroAccent} />
          <View style={styles.balanceHeroContent}>
            <Text style={styles.balanceHeroLabel}>SOLDE COLLECTÉ CE MOIS</Text>
            <View style={styles.balanceHeroRow}>
              <Text style={styles.balanceHeroAmount}>
                {isLoading ? '···' : totalBalance.toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.balanceHeroCurrency}>{currency}</Text>
            </View>
          </View>
          <View style={styles.balanceHeroCircle}>
            <Text style={styles.balanceHeroCircleNumber}>
              {Math.round(paidPct * 100)}
            </Text>
            <Text style={styles.balanceHeroCirclePct}>%</Text>
          </View>
        </View>

        {/* ── GRILLE 2×2 de stats ──────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCell, styles.statCellPaid]}>
            <MaterialCommunityIcons name="check-circle" size={20} color={Colors.secondary} />
            <Text style={styles.statCellValue}>{paidContribs.length}</Text>
            <Text style={styles.statCellLabel}>Payés</Text>
          </View>
          <View style={[styles.statCell, styles.statCellLate]}>
            <MaterialCommunityIcons name="clock-alert-outline" size={20} color={Colors.warning} />
            <Text style={[styles.statCellValue, { color: lateContribs.length > 0 ? Colors.warning : Colors.onSurface }]}>
              {lateContribs.length}
            </Text>
            <Text style={styles.statCellLabel}>En attente</Text>
          </View>
          <View style={[styles.statCell, styles.statCellMembers]}>
            <MaterialCommunityIcons name="account-group" size={20} color={Colors.tertiary} />
            <Text style={styles.statCellValue}>{members.length}</Text>
            <Text style={styles.statCellLabel}>Membres</Text>
          </View>
          <View style={[styles.statCell, styles.statCellDeadline]}>
            <MaterialCommunityIcons name="calendar-check" size={20} color={Colors.gold} />
            <Text style={[styles.statCellValue, { fontSize: 15, color: Colors.goldDark }]}>
              {dueDate ? `${dueDate.getDate()} ${dueDate.toLocaleDateString('fr-FR', { month: 'short' })}` : '--'}
            </Text>
            <Text style={styles.statCellLabel}>Échéance</Text>
          </View>
        </View>

        {/* ── BARRE DE PROGRESSION ────────────────────────────────────── */}
        <View style={styles.progressStrip}>
          <View style={styles.progressStripLabels}>
            <Text style={styles.progressStripTitle}>Collecte du mois</Text>
            <Text style={styles.progressStripFrac}>
              <Text style={styles.progressStripFracBold}>{paidContribs.length}</Text>
              <Text style={styles.progressStripFracLight}> / {members.length} membres</Text>
            </Text>
          </View>
          <ProgressBar
            current={paidContribs.length}
            total={members.length || 1}
            color={paidPct >= 0.9 ? Colors.secondary : paidPct >= 0.5 ? Colors.tertiary : Colors.warning}
            height={10}
          />
        </View>

        {/* ── ACTIONS RAPIDES 2×2 ─────────────────────────────────────── */}
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: Colors.primary }]}
            onPress={() => setShowConfirm(true)}
            activeOpacity={0.85}
          >
            <View style={styles.quickActionIcon}>
              <MaterialCommunityIcons name="bell-ring-outline" size={22} color={Colors.gold} />
            </View>
            <Text style={[styles.quickActionLabel, { color: '#FFF' }]}>Envoyer rappels</Text>
            {lateContribs.length > 0 && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>{lateContribs.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant }]}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.goldMuted }]}>
              <MaterialCommunityIcons name="file-pdf-box" size={22} color={Colors.goldDark} />
            </View>
            <Text style={styles.quickActionLabel}>Exporter PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant }]}
            onPress={() => navigation.navigate('MemberManagement')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.surfaceContainerHigh }]}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={22} color={Colors.tertiary} />
            </View>
            <Text style={styles.quickActionLabel}>Gérer membres</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant }]}
            onPress={() => navigation.navigate('GroupConfig')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.surfaceContainerHigh }]}>
              <MaterialCommunityIcons name="cog-outline" size={22} color={Colors.onSurfaceVariant} />
            </View>
            <Text style={styles.quickActionLabel}>Paramètres</Text>
          </TouchableOpacity>
        </View>

        {/* ── TIMELINE : Membres en attente ───────────────────────────── */}
        {lateContribs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>En attente</Text>
              <View style={styles.countBubble}>
                <Text style={styles.countBubbleText}>{lateContribs.length}</Text>
              </View>
            </View>
            <View style={styles.timelineContainer}>
              {lateContribs.slice(0, 4).map((c, i) => (
                <View key={c.id} style={styles.timelineItem}>
                  {/* Timeline connector */}
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      { backgroundColor: c.status === 'EN_RETARD' ? Colors.error : Colors.warning }
                    ]} />
                    {i < lateContribs.slice(0, 4).length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <MemberPaymentRow
                      member={{ id: c.user_id, fullName: c.full_name, phone: c.phone, paymentStatus: c.status, amount: c.amount }}
                      showReminder={false}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── MEMBRES AYANT PAYÉ ──────────────────────────────────────── */}
        {paidContribs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Paiements reçus</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ApprovalQueue')}>
                <Text style={styles.seeAll}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.paidList}>
              {paidContribs.slice(0, 3).map((c, i) => (
                <TouchableOpacity key={c.id} style={[styles.paidRow, i > 0 && styles.paidRowBorder]} activeOpacity={0.7} onPress={() => navigation.navigate('Receipt', { txId: c.id ?? '' })}>
                  <Avatar name={c.full_name ?? '?'} size={38} bgColor={Colors.goldMuted} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.paidName}>{c.full_name ?? '—'}</Text>
                    <Text style={styles.paidSub}>Contribution confirmée</Text>
                  </View>
                  <Text style={styles.paidAmount}>+{Math.round((c.amount ?? 0) / 1000)}k</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── MEMBRES (horizontal scroll) ─────────────────────────────── */}
        {members.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Membres</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MemberManagement')}>
                <Text style={styles.seeAll}>Gérer →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {members.slice(0, 6).map((m, i) => {
                const hasPaid = paidContribs.some(c => c.user_id === m.id);
                return (
                  <View key={m.id} style={[styles.memberPill, hasPaid && styles.memberPillPaid]}>
                    <Avatar name={m.full_name ?? '?'} size={32} bgColor={hasPaid ? Colors.secondary + '20' : Colors.surfaceVariant} />
                    <Text style={styles.memberPillName} numberOfLines={1}>
                      {(m.full_name ?? '?').split(' ')[0]}
                    </Text>
                    <View style={[styles.memberPillDot, { backgroundColor: hasPaid ? Colors.secondary : Colors.warning }]} />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Modal confirm reminders ──────────────────────────────────── */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="bell-ring-outline" size={32} color={Colors.gold} />
            </View>
            <Text style={styles.modalTitle}>Envoyer les rappels ?</Text>
            <Text style={styles.modalMsg}>
              Une notification sera envoyée aux {lateContribs.length} membre(s) en attente de paiement.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowConfirm(false)}>
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleSendReminders} disabled={sending}>
                <Text style={styles.modalBtnConfirmText}>{sending ? 'Envoi...' : 'Confirmer'}</Text>
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

  // ── Header Greeting ──────────────────────────────────────────
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoLetter: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.primary,
    lineHeight: 24,
  },
  headerGreeting: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
  },
  headerDate: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerAppName: { fontFamily: Fonts.display, fontSize: 18, color: Colors.primary },

  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },

  // Group chip
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '50',
    ...Shadow.card,
  },
  groupChipText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.onSurface,
  },
  adminChip: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  adminChipText: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: Colors.goldDark,
    letterSpacing: 0.8,
  },

  // Balance hero — horizontal card
  balanceHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xxl,
    marginBottom: 14,
    overflow: 'hidden',
    ...Shadow.fab,
  },
  balanceHeroAccent: {
    width: 6,
    alignSelf: 'stretch',
    backgroundColor: Colors.gold,
  },
  balanceHeroContent: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  balanceHeroLabel: {
    fontFamily: Fonts.title,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  balanceHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  balanceHeroAmount: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.gold,
    letterSpacing: -1,
  },
  balanceHeroCurrency: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: 'rgba(201,168,76,0.65)',
  },
  balanceHeroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    flexDirection: 'row',
  },
  balanceHeroCircleNumber: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  balanceHeroCirclePct: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // 2×2 Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCell: {
    width: '47.5%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
    ...Shadow.card,
  },
  statCellPaid: { borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  statCellLate: { borderLeftWidth: 3, borderLeftColor: Colors.warning },
  statCellMembers: { borderLeftWidth: 3, borderLeftColor: Colors.tertiary },
  statCellDeadline: { borderLeftWidth: 3, borderLeftColor: Colors.gold },
  statCellValue: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.onSurface,
    letterSpacing: -0.5,
  },
  statCellLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },

  // Progress strip
  progressStrip: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  progressStripLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  progressStripTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
  },
  progressStripFrac: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  progressStripFracBold: { fontFamily: Fonts.headline, color: Colors.primary },
  progressStripFracLight: { color: Colors.textMuted },

  // Quick Actions 2×2
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    width: '47.5%',
    borderRadius: Radius.xl,
    padding: 16,
    gap: 8,
    position: 'relative',
    ...Shadow.card,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: Colors.onSurface,
  },
  quickActionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionBadgeText: {
    fontFamily: Fonts.headline,
    fontSize: 10,
    color: Colors.primary,
  },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 17, color: Colors.onSurface },
  seeAll: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  countBubble: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  countBubbleText: { fontFamily: Fonts.headline, fontSize: 12, color: Colors.warning },

  // Timeline layout for late members
  timelineContainer: { gap: 0 },
  timelineItem: { flexDirection: 'row' },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
    paddingTop: 18,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 0,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.outlineVariant,
    marginTop: 2,
  },
  timelineContent: { flex: 1 },

  // Paid list
  paidList: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  paidRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '40',
  },
  paidName: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  paidSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  paidAmount: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.secondary },

  // Members horizontal pills
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
  },
  memberPillPaid: {
    borderColor: Colors.secondary + '40',
    backgroundColor: Colors.secondary + '08',
  },
  memberPillName: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.onSurface,
  },
  memberPillDot: { width: 6, height: 6, borderRadius: 3 },

  // Empty state
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
  },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.55)', justifyContent: 'center', padding: 28,
  },
  modal: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 28,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
  },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface, marginBottom: 8 },
  modalMsg: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center' },
  modalBtnCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant, fontSize: 14 },
  modalBtnConfirm: { flex: 2, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.primary, alignItems: 'center' },
  modalBtnConfirmText: { fontFamily: Fonts.headline, color: '#FFF', fontSize: 15 },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: Fonts.headline, color: Colors.primary },
});

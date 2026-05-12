import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import * as db from '../../services/database';
import { useAuthStore } from '../../stores/authStore';
import { fmtDate } from '../../utils/formatDate';
import { useNotificationStore } from '../../stores/notificationStore';

function normalizeContributionStatus(status?: string | null) {
  switch (status) {
    case 'PAYE':
    case 'paid':
    case 'approved':
      return 'paid';
    case 'EN_ATTENTE':
    case 'pending':
      return 'pending';
    case 'pending_approval':
    case 'EN_VERIFICATION':
      return 'verifying';
    case 'EN_RETARD':
    case 'late':
      return 'late';
    case 'rejected':
    case 'REJETEE':
      return 'rejected';
    default:
      return 'none';
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, bg }: { name: string; size?: number; bg?: string }) {
  const initials = (name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: Fonts.headline, fontSize: size * 0.36, color: Colors.primary }}>{initials}</Text>
    </View>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ navigation }: { navigation: any }) {
  const unreadCount = useNotificationStore(st => st.unreadCount);
  return (
    <View style={s.topBar}>
      <View style={s.topBarLeft}>
        <View style={s.topBarLogoWrap}>
          <Text style={s.topBarLogoLetter}>C</Text>
        </View>
        <View>
          <View style={s.topBarBrandRow}>
            <Text style={s.topBarTitle}>ContribApp</Text>
            <View style={s.topBarRdcChip}>
              <Text style={s.topBarRdcText}>RDC</Text>
            </View>
          </View>
        </View>
      </View>
      <TouchableOpacity style={s.topBarBtn} onPress={() => navigation.navigate('Notifications')}>
        <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.onSurfaceVariant} />
        {unreadCount > 0 && (
          <View style={s.bellBadge}>
            <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Hero Card : PAYÉ ─────────────────────────────────────────────────────────
function HeroCardPaid({ contribution, checkAnim, navigation }: { contribution: any; checkAnim: Animated.Value; navigation: any }) {
  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] });
  return (
    <View style={[s.heroCard, s.heroCardPaid]}>
      <View style={s.heroCardSideBar} />
      <View style={s.heroCardInner}>
        <View style={s.heroCardRow}>
          <Text style={[s.heroTitle, { color: '#1b5e20' }]}>Contribution payée !</Text>
          <View style={[s.heroPill, { backgroundColor: '#C8F5D0' }]}>
            <View style={[s.heroPillDot, { backgroundColor: '#1B6D24' }]} />
            <Text style={[s.heroPillText, { color: '#1B6D24' }]}>PAYÉ</Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ scale }], alignSelf: 'center', marginVertical: 16 }}>
          <View style={s.heroIconCircle}>
            <MaterialCommunityIcons name="check-circle" size={40} color="#27ae60" />
          </View>
        </Animated.View>
        <Text style={[s.heroDetail, { color: '#2e7d32' }]}>
          Montant : {(contribution?.amount ?? 0).toLocaleString('fr-FR')} CDF
        </Text>
        {contribution?.paid_at && (
          <Text style={[s.heroDetail, { color: '#388e3c' }]}>
            Date de paiement : {fmtDate(contribution.paid_at)}
          </Text>
        )}
        <TouchableOpacity style={s.heroLinkRow} onPress={() => navigation.navigate('Receipt', { txId: contribution?.id ?? '' })}>
          <Text style={[s.heroLinkText, { color: '#27ae60' }]}>Voir le reçu</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color="#27ae60" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Hero Card : EN ATTENTE ───────────────────────────────────────────────────
function HeroCardPending({ contribution, daysLeft, onPay }: { contribution: any; daysLeft: number; onPay: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isUrgent = daysLeft <= 2;
  useEffect(() => {
    if (isUrgent) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    }
  }, [isUrgent]);
  return (
    <View style={[s.heroCard, s.heroCardPending]}>
      <View style={[s.heroCardSideBar, { backgroundColor: '#e65100' }]} />
      <View style={s.heroCardInner}>
        <View style={s.heroCardRow}>
          <Text style={[s.heroTitle, { color: '#e65100' }]}>Contribution à payer</Text>
          <View style={[s.heroPill, { backgroundColor: '#FFE5CC' }]}>
            <View style={[s.heroPillDot, { backgroundColor: '#e65100' }]} />
            <Text style={[s.heroPillText, { color: '#e65100' }]}>ATTENTE</Text>
          </View>
        </View>
        <Text style={[s.heroAmount, { color: '#e65100', marginTop: 12 }]}>
          {(contribution?.amount ?? 0).toLocaleString('fr-FR')}
          <Text style={s.heroAmountUnit}> CDF</Text>
        </Text>
        <Animated.Text style={[s.heroCountdown, { color: isUrgent ? Colors.error : '#e65100', opacity: isUrgent ? pulseAnim : 1 }]}>
          Il vous reste {daysLeft} jour{daysLeft !== 1 ? 's' : ''}
        </Animated.Text>
        <TouchableOpacity style={[s.payNowBtn, { backgroundColor: '#e65100' }]} activeOpacity={0.85} onPress={onPay}>
          <MaterialCommunityIcons name="cash-multiple" size={18} color="#FFF" />
          <Text style={s.payNowBtnText}>PAYER MAINTENANT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Hero Card : EN RETARD ────────────────────────────────────────────────────
function HeroCardLate({ contribution, onPay }: { contribution: any; onPay: (withPenalty: boolean) => void }) {
  const base = contribution?.amount ?? 0;
  const penalty = contribution?.penalty_amount ?? 0;
  const total = base + penalty;
  return (
    <View style={[s.heroCard, s.heroCardLate]}>
      <View style={[s.heroCardSideBar, { backgroundColor: Colors.error }]} />
      <View style={s.heroCardInner}>
        <View style={s.heroCardRow}>
          <Text style={[s.heroTitle, { color: '#b71c1c' }]}>Contribution en retard !</Text>
          <View style={[s.heroPill, { backgroundColor: '#FFCDD2' }]}>
            <View style={[s.heroPillDot, { backgroundColor: '#b71c1c' }]} />
            <Text style={[s.heroPillText, { color: '#b71c1c' }]}>RETARD</Text>
          </View>
        </View>
        <Text style={[s.heroDetail, { color: Colors.onSurface, marginTop: 12 }]}>
          Montant de base : {base.toLocaleString('fr-FR')} CDF
        </Text>
        {penalty > 0 && (
          <>
            <View style={s.heroPenaltyRow}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={Colors.error} />
              <Text style={[s.heroDetail, { color: Colors.error }]}>
                Pénalité de retard : +{penalty.toLocaleString('fr-FR')} CDF
              </Text>
            </View>
            <View style={s.heroDivider} />
            <Text style={[s.heroAmount, { color: Colors.error }]}>
              {total.toLocaleString('fr-FR')}
              <Text style={s.heroAmountUnit}> CDF</Text>
            </Text>
          </>
        )}
        <TouchableOpacity
          style={[s.payNowBtn, { backgroundColor: penalty > 0 ? Colors.error : Colors.warning }]}
          activeOpacity={0.85}
          onPress={() => onPay(penalty > 0)}
        >
          <MaterialCommunityIcons name="cash-multiple" size={18} color="#FFF" />
          <Text style={s.payNowBtnText}>
            {penalty > 0 ? 'PAYER (avec pénalité)' : 'PAYER MAINTENANT'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Hero Card : EN VÉRIFICATION (pending_approval) ───────────────────────────
function HeroCardVerification({ onPay }: { onPay: () => void }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={[s.heroCard, { backgroundColor: '#F8F0FE', borderColor: 'transparent' }]}>
      <View style={[s.heroCardSideBar, { backgroundColor: '#9B59B6' }]} />
      <View style={s.heroCardInner}>
        <View style={s.heroCardRow}>
          <Text style={[s.heroTitle, { color: '#6A1B9A' }]}>Capture en vérification</Text>
          <View style={[s.heroPill, { backgroundColor: '#E1BEE7' }]}>
            <View style={[s.heroPillDot, { backgroundColor: '#9B59B6' }]} />
            <Text style={[s.heroPillText, { color: '#6A1B9A' }]}>EN COURS</Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: spin }], alignSelf: 'center', marginVertical: 16 }}>
          <MaterialCommunityIcons name="clock-outline" size={48} color="#9B59B6" />
        </Animated.View>
        <Text style={[s.heroDetail, { color: '#6A1B9A', textAlign: 'center' }]}>
          La trésorière examine votre capture. Vous serez notifié dès validation.
        </Text>
        <TouchableOpacity style={s.heroLinkRow} onPress={onPay}>
          <Text style={[s.heroLinkText, { color: '#8E24AA' }]}>Voir ma soumission</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color="#8E24AA" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Hero Card : REJETÉE ──────────────────────────────────────────────────────
function HeroCardRejected({ contribution, onPay }: { contribution: any; onPay: () => void }) {
  return (
    <View style={[s.heroCard, { backgroundColor: '#FEF0F0', borderColor: 'transparent' }]}>
      <View style={[s.heroCardSideBar, { backgroundColor: Colors.error }]} />
      <View style={s.heroCardInner}>
        <View style={s.heroCardRow}>
          <Text style={[s.heroTitle, { color: '#C62828' }]}>Contribution rejetée</Text>
          <View style={[s.heroPill, { backgroundColor: '#FFCDD2' }]}>
            <View style={[s.heroPillDot, { backgroundColor: '#C62828' }]} />
            <Text style={[s.heroPillText, { color: '#C62828' }]}>REJETÉE</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="close-circle-outline" size={48} color="#F44336" style={{ alignSelf: 'center', marginVertical: 16 }} />
        <Text style={[s.heroDetail, { color: '#C62828', textAlign: 'center', fontStyle: 'italic' }]}>
          Raison : {contribution?.rejection_reason || 'Capture non valide'}
        </Text>
        <TouchableOpacity
          style={[s.payNowBtn, { backgroundColor: '#F44336', marginTop: 16 }]}
          activeOpacity={0.85}
          onPress={onPay}
        >
          <MaterialCommunityIcons name="camera-retake" size={18} color="#FFF" />
          <Text style={s.payNowBtnText}>Soumettre une nouvelle capture</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ÉCRAN PRINCIPAL ──────────────────────────────────────────────────────────
export default function MemberDashboardScreen({ navigation }: any) {
  const user = useAuthStore(st => st.user);
  const uid = useAuthStore(st => st.uid);
  const setGroupId = useAuthStore(st => st.setGroupId);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [contribution, setContribution] = useState<any>(null);
  const [groupProgress, setGroupProgress] = useState({ paid: 0, total: 0 });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [topMembers, setTopMembers] = useState<any[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const checkAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const g = await db.getGroupForMember(uid || '');
      setGroup(g);
      if (!g) {
        setContribution(null);
        setGroupProgress({ paid: 0, total: 0 });
        setRecentPayments([]);
        setTopMembers([]);
        return;
      }
      if (g) {
        const [c, allC, recent, members] = await Promise.all([
          db.getMemberContribution(uid || '', g.id),
          db.getContributionsForMonth(g.id),
          db.getRecentPaymentsForMember(uid || '', 3).catch(() => [] as any[]),
          db.getMembersOfGroup(g.id).catch(() => [] as any[]),
        ]);
        const groupMonthlyAmount = g.contribution_amount || g.monthly_amount || 0;
        const normalizedContribution = c
          ? {
              ...c,
              amount:     c.amount     > 0 ? c.amount     : groupMonthlyAmount,
              amount_due: c.amount_due > 0 ? c.amount_due : groupMonthlyAmount,
            }
          : groupMonthlyAmount > 0
            ? {
                amount:     groupMonthlyAmount,
                amount_due: groupMonthlyAmount,
                penalty_amount: 0,
                status: 'EN_ATTENTE',
                user_id: uid || '',
                group_id: g.id,
                month: db.getCurrentMonthKey(),
              }
            : null;
        setContribution(normalizedContribution);

        setGroupProgress({
          paid: allC.filter((x: any) => x.status === 'PAYE' || x.status === 'paid').length,
          total: allC.length,
        });
        setRecentPayments(recent);
        const ranking = members
          .map((m: any) => {
            const paid = allC.filter(
              (x: any) =>
                (x.user_id === m.id || x.member_uid === m.id) &&
                (x.status === 'PAYE' || x.status === 'paid')
            );
            const totalPaid = paid.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
            return {
              id: m.id,
              full_name: m.full_name,
              totalPaid,
              paidCount: paid.length,
              isCurrentUser: m.id === uid,
            };
          })
          .sort((a: any, b: any) => {
            if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
            if (b.paidCount !== a.paidCount) return b.paidCount - a.paidCount;
            return String(a.full_name).localeCompare(String(b.full_name), 'fr');
          })
          .slice(0, 5);
        setTopMembers(ranking);
      }
    } catch (err) {
      console.error('[MemberDashboard] loadData error:', err);
      Toast.show({ type: 'error', text1: 'Erreur de chargement', text2: 'Vérifiez votre connexion.' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (normalizeContributionStatus(contribution?.status) === 'paid') {
      Animated.spring(checkAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }).start();
    }
  }, [contribution?.status]);

  const handleRefresh = () => { setRefreshing(true); loadData().then(() => setRefreshing(false)); };

  const handleJoinGroup = async () => {
    if (!user) return;
    setJoining(true); setJoinError('');
    try {
      const foundGroup = await db.getGroupByInviteCode(inviteCode);
      if (!foundGroup) { setJoinError('Code invalide. Vérifiez et réessayez.'); setJoining(false); return; }
      const alreadyIn = await db.isAlreadyMember(uid || '', foundGroup.id);
      if (alreadyIn) { setJoinError('Vous êtes déjà membre.'); setJoining(false); return; }
      await db.joinGroup(uid || '', foundGroup.id);
      setGroupId(foundGroup.id);
      setShowJoinModal(false); setInviteCode('');
      Toast.show({ type: 'success', text1: 'Bienvenue !', text2: `Vous avez rejoint "${foundGroup.name}".` });
      await loadData();
    } catch { setJoinError('Erreur. Réessayez.'); }
    finally { setJoining(false); }
  };

  // ── Navigation vers le paiement avec les vrais paramètres ─────────────────
  const goToPayment = (withPenalty = false) => {
    const penalty = contribution?.penalty_amount ?? 0;
    const base    = contribution?.amount ?? group?.contribution_amount ?? group?.monthly_amount ?? 0;
    navigation?.navigate('SubmitContribution', {
      amount:        withPenalty ? base + penalty : base,
      includePenalty: withPenalty && penalty > 0,
      groupId:       group?.id   ?? '',
      memberUid:     uid         ?? '',
      memberName:    user?.fullName ?? '',
      periodMonth:   db.getCurrentMonthKey(),
    });
  };

  const status = contribution?.status ?? null;
  const normalizedStatus = normalizeContributionStatus(status);
  const dueDay = group?.payment_deadline_day ?? group?.due_day ?? 25;
  const dueMonthLabel = new Date().toLocaleDateString('fr-FR', { month: 'short' });
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);

  const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() - 1, dueDay);
  const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / 86400000));

  const paidPct = groupProgress.total > 0 ? groupProgress.paid / groupProgress.total : 0;
  const progressBarColor = paidPct >= 0.9 ? Colors.secondary : paidPct >= 0.5 ? Colors.tertiary : Colors.warning;
  const monthlyAmount = group?.contribution_amount ?? group?.monthly_amount ?? 0;
  const totalBalance = groupProgress.paid * monthlyAmount;
  const statusLabel =
    normalizedStatus === 'paid'
      ? 'Payée'
      : normalizedStatus === 'pending'
        ? 'En attente'
        : normalizedStatus === 'verifying'
          ? 'Vérification'
          : normalizedStatus === 'late'
            ? 'En retard'
            : normalizedStatus === 'rejected'
              ? 'À reprendre'
              : 'À payer';

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!isLoading && !group) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <TopBar navigation={navigation} />
        <View style={s.emptyBody}>
          <View style={s.emptyIconWrap}>
            <MaterialCommunityIcons name="account-group-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Pas encore de groupe</Text>
          <Text style={s.emptySub}>Rejoignez un groupe pour commencer à cotiser.</Text>
          <TouchableOpacity style={s.joinBigBtn} onPress={() => setShowJoinModal(true)}>
            <MaterialCommunityIcons name="account-group" size={18} color="#FFF" />
            <Text style={s.joinBigBtnText}>Rejoindre un groupe</Text>
          </TouchableOpacity>
        </View>

        {showJoinModal && (
          <View style={s.modalOverlay}>
            <JoinModalContent
              code={inviteCode} error={joinError} joining={joining}
              onChangeCode={(t: string) => { setInviteCode(t.toUpperCase()); setJoinError(''); }}
              onCancel={() => { setShowJoinModal(false); setInviteCode(''); setJoinError(''); }}
              onConfirm={handleJoinGroup}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── GREETING + STATUT ───────────────────────────────────────── */}
        <View style={s.greetingRow}>
          <View>
            <Text style={s.greetingName}>
              {(user?.fullName ?? 'Membre').split(' ')[0]}
            </Text>
            {group?.name && <Text style={s.greetingGroup}>{group.name}</Text>}
          </View>
          <View style={[
            s.statusPillLarge,
            {
              backgroundColor: normalizedStatus === 'paid'
                ? Colors.secondary + '15'
                : normalizedStatus === 'late'
                  ? Colors.error + '15'
                  : Colors.warning + '15',
            }
          ]}>
            <View style={[
              s.statusPillDot,
              {
                backgroundColor: normalizedStatus === 'paid'
                  ? Colors.secondary
                  : normalizedStatus === 'late'
                    ? Colors.error
                    : Colors.warning,
              }
            ]} />
            <Text style={[
              s.statusPillText,
              {
                color: normalizedStatus === 'paid'
                  ? Colors.secondary
                  : normalizedStatus === 'late'
                    ? Colors.error
                    : Colors.warning,
              }
            ]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* ── HERO CARD EN PREMIER — c'est la priorité visuelle ─────── */}
        <View style={s.heroSection}>
          {isLoading ? (
            <View style={[s.skeleton, { height: 180, marginBottom: 0 }]} />
          ) : normalizedStatus === 'paid' ? (
            <HeroCardPaid contribution={contribution} checkAnim={checkAnim} navigation={navigation} />
          ) : normalizedStatus === 'verifying' ? (
            <HeroCardVerification onPay={() => goToPayment()} />
          ) : normalizedStatus === 'rejected' ? (
            <HeroCardRejected contribution={contribution} onPay={() => goToPayment()} />
          ) : normalizedStatus === 'late' ? (
            <HeroCardLate contribution={contribution} onPay={goToPayment} />
          ) : (
            <HeroCardPending contribution={contribution} daysLeft={daysLeft} onPay={() => goToPayment()} />
          )}
        </View>

        {/* ── Pay Now (quand aucune contribution) ──────────────────────── */}
        {!status && (
          <TouchableOpacity style={s.payBtn} activeOpacity={0.88} onPress={() => goToPayment()}>
            <MaterialCommunityIcons name="cash-multiple" size={22} color="#FFF" />
            <Text style={s.payBtnText}>Payer maintenant</Text>
          </TouchableOpacity>
        )}

        {/* ── BALANCE COMPACTE — sous la hero card, pas au-dessus ──────── */}
        <View style={s.balanceStrip}>
          <View style={s.balanceStripLeft}>
            <Text style={s.balanceStripLabel}>SOLDE DU GROUPE</Text>
            <View style={s.balanceStripRow}>
              <Text style={s.balanceStripAmount}>
                {isLoading ? '···' : totalBalance.toLocaleString('fr-FR')}
              </Text>
              <Text style={s.balanceStripCurrency}>CDF</Text>
            </View>
          </View>
          <View style={s.balanceStripDivider} />
          <View style={s.balanceStripRight}>
            <Text style={s.balanceStripLabel}>ÉCHÉANCE</Text>
            <Text style={s.balanceStripDeadline}>{dueDay} {dueMonthLabel}</Text>
          </View>
        </View>

        {/* ── Widget : Progression du groupe ─────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <MaterialCommunityIcons name="chart-line" size={16} color={Colors.primary} />
            </View>
            <Text style={s.cardTitle}>Progression du groupe</Text>
          </View>
          <View style={s.progressLabelRow}>
            <Text style={s.cardSub}>
              {groupProgress.paid} / {groupProgress.total} membres ont payé
            </Text>
            <Text style={[s.cardSub, { color: Colors.primary, fontFamily: Fonts.headline }]}>
              {groupProgress.total > 0 ? Math.round((groupProgress.paid / groupProgress.total) * 100) : 0}%
            </Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar
              current={groupProgress.paid}
              total={groupProgress.total || 1}
              color={progressBarColor}
              height={8}
            />
          </View>
          {groupProgress.total - groupProgress.paid > 0 && (
            <Text style={s.cardSub2}>{groupProgress.total - groupProgress.paid} membres restants</Text>
          )}
        </View>

        {/* ── Latest Activity ─────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Activité récente</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Historique')}>
              <Text style={s.seeAll}>Voir tout →</Text>
            </TouchableOpacity>
          </View>
          <View style={s.activityContainer}>
            {isLoading ? (
              <><View style={s.skeleton} /><View style={s.skeleton} /></>
            ) : recentPayments.length === 0 ? (
              <Text style={s.emptyText}>Aucun paiement enregistré pour le moment.</Text>
            ) : (
              recentPayments.map((p: any, i: number) => (
                <TouchableOpacity key={p.id ?? i} style={s.actItem} activeOpacity={0.7} onPress={() => navigation.navigate('Receipt', { txId: p.id ?? '' })}>
                  <View style={s.actAvatarWrap}>
                    <Avatar name={p.full_name ?? user?.fullName ?? '?'} size={44} bg={Colors.surfaceVariant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actName}>{p.full_name ?? user?.fullName ?? '—'}</Text>
                    <Text style={s.actSub}>Contribution confirmée</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.actAmount}>+{Math.round((p.amount ?? 0) / 1000)}k</Text>
                    <Text style={s.actTime}>
                      {fmtDate(p.paid_at, { day: '2-digit', month: '2-digit' }, 'Ce mois')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* ── Top Members ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: 24 }}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Meilleurs cotisants</Text>
            <View style={s.trophyChip}>
              <Text style={s.trophyChipText}>🏆</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {topMembers.length === 0 ? (
              <View style={s.memberCard}>
                <Text style={s.memberName}>Aucune donnée</Text>
              </View>
            ) : (
              topMembers.map((member: any, index: number) => (
                <View
                  key={member.id ?? index}
                  style={[
                    s.memberCard,
                    index === 0 && s.memberCardGold,
                    member.isCurrentUser && s.memberCardCurrent,
                  ]}
                >
                  <View style={[
                    s.memberAvatarWrap,
                    {
                      backgroundColor: index === 0
                        ? Colors.goldMuted
                        : member.isCurrentUser
                          ? Colors.primaryFixed + '40'
                          : Colors.surfaceContainerHigh,
                    },
                  ]}>
                    {index === 0 ? (
                      <MaterialCommunityIcons name="medal" size={28} color={Colors.gold} />
                    ) : (
                      <Avatar name={member.full_name ?? '?'} size={40} bg={Colors.surfaceContainer} />
                    )}
                  </View>
                  <Text style={[s.memberRank, { color: index === 0 ? Colors.gold : Colors.textMuted }]}>
                    #{index + 1}
                  </Text>
                  <Text style={s.memberName} numberOfLines={1}>
                    {member.isCurrentUser ? 'Vous' : member.full_name}
                  </Text>
                  <Text style={[s.memberAmount, { color: index === 0 ? Colors.goldDark : Colors.secondary }]}>
                    {Math.round(member.totalPaid).toLocaleString('fr-FR')} CDF
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── Prochaine échéance (masqué si EN_RETARD) ─────────────── */}
        {group && normalizedStatus !== 'late' && (
          <View style={s.nextCard}>
            <View style={s.nextCardIcon}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>
                {nextMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </Text>
              <Text style={s.cardSub}>
                À payer avant le {dueDay} {nextMonth.toLocaleDateString('fr-FR', { month: 'short' })}
              </Text>
            </View>
            <View style={s.nextAmountWrap}>
              <Text style={s.nextAmount}>{monthlyAmount.toLocaleString('fr-FR')}</Text>
              <Text style={s.nextAmountUnit}>CDF</Text>
            </View>
          </View>
        )}

        {/* Rejoindre un groupe */}
        <TouchableOpacity style={s.joinGroupBtn} onPress={() => setShowJoinModal(true)}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={17} color={Colors.primary} />
          <Text style={s.joinGroupBtnText}>Entrer un code d'invitation</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Modal d'invitation */}
      {showJoinModal && (
        <View style={s.modalOverlay}>
          <JoinModalContent
            code={inviteCode} error={joinError} joining={joining}
            onChangeCode={(t: string) => { setInviteCode(t.toUpperCase()); setJoinError(''); }}
            onCancel={() => { setShowJoinModal(false); setInviteCode(''); setJoinError(''); }}
            onConfirm={handleJoinGroup}
          />
        </View>
      )}
    </View>
  );
}

// ─── Join Modal content ───────────────────────────────────────────────────────
function JoinModalContent({ code, error, joining, onChangeCode, onCancel, onConfirm }: any) {
  const { TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } = require('react-native');
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ width: '100%' }}
    >
      <View style={s.modalBox}>
        <View style={s.modalIconWrap}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={32} color={Colors.gold} />
        </View>
        <Text style={s.modalTitle}>Code d'invitation</Text>
        <Text style={s.modalSub}>Entrez le code fourni par l'administrateur du groupe.</Text>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={onChangeCode}
          placeholder="ABC-123"
          placeholderTextColor={Colors.outlineVariant}
          autoCapitalize="characters"
          maxLength={12}
          autoFocus
        />
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <View style={s.modalBtns}>
          <TouchableOpacity style={s.modalBtnCancel} onPress={onCancel}>
            <Text style={s.modalBtnCancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modalBtnConfirm, code.length < 4 && { opacity: 0.5 }]}
            onPress={onConfirm}
            disabled={joining || code.length < 4}
          >
            {joining
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.modalBtnConfirmText}>Rejoindre</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // Greeting row
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingName: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.onSurface,
    letterSpacing: -0.3,
  },
  greetingGroup: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusPillLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  statusPillDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontFamily: Fonts.headline, fontSize: 12 },

  // Balance compact strip
  balanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    ...Shadow.card,
  },
  balanceStripLeft: { flex: 1 },
  balanceStripLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  balanceStripRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  balanceStripAmount: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.gold,
    letterSpacing: -0.8,
  },
  balanceStripCurrency: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    color: 'rgba(201,168,76,0.6)',
  },
  balanceStripDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  balanceStripRight: { alignItems: 'flex-end' },
  balanceStripDeadline: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
  },

  // TopBar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarLogoWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarLogoLetter: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: Colors.primary,
    lineHeight: 22,
  },
  topBarBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 18, color: Colors.primary },
  topBarRdcChip: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  topBarRdcText: { fontFamily: Fonts.title, fontSize: 9, color: Colors.goldDark, letterSpacing: 0.8 },
  topBarBtn: { padding: 8, borderRadius: Radius.full },
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

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },


  // Hero Cards
  heroSection: { marginBottom: 20 },
  heroCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadow.card,
  },
  heroCardSideBar: {
    width: 5,
    backgroundColor: Colors.secondary,
  },
  heroCardInner: {
    flex: 1,
    padding: 18,
  },
  heroCardPaid: { backgroundColor: '#F0FBF2' },
  heroCardPending: { backgroundColor: '#FFF8F0' },
  heroCardLate: { backgroundColor: '#FEF5F5' },
  heroCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontFamily: Fonts.headline, fontSize: 15, flex: 1, marginRight: 8 },
  heroAmount: { fontFamily: Fonts.display, fontSize: 30, letterSpacing: -1 },
  heroAmountUnit: { fontFamily: Fonts.headline, fontSize: 16 },
  heroCountdown: { fontFamily: Fonts.headline, fontSize: 14, marginBottom: 16, marginTop: 4 },
  heroDetail: { fontFamily: Fonts.body, fontSize: 13, marginBottom: 4, lineHeight: 18 },
  heroPenaltyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heroDivider: { height: 1, backgroundColor: '#ffcdd2', marginVertical: 10 },
  heroLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  heroLinkText: { fontFamily: Fonts.title, fontSize: 13 },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(39,174,96,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Status pills (in hero cards)
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  heroPillDot: { width: 5, height: 5, borderRadius: 3 },
  heroPillText: { fontFamily: Fonts.title, fontSize: 9, letterSpacing: 0.5 },

  // Pay Now
  payBtn: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    ...Shadow.fab,
  },
  payBtnText: { fontFamily: Fonts.headline, fontSize: 16, color: '#FFF', letterSpacing: 0.3 },
  payNowBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  payNowBtnText: { fontFamily: Fonts.headline, fontSize: 14, color: '#FFF', letterSpacing: 0.2 },

  // Cards
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 20,
    ...Shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.onSurface },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.onSurfaceVariant },
  cardSub2: { fontFamily: Fonts.body, fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 7 },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  seeAll: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  emptyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingVertical: 12, textAlign: 'center' },
  skeleton: { height: 52, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, marginBottom: 8 },

  activityContainer: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: 6,
    gap: 3,
  },
  actItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 14,
  },
  actAvatarWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLow,
  },
  actName: { fontFamily: Fonts.headline, fontSize: 13, color: Colors.onSurface },
  actSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  actAmount: { fontFamily: Fonts.headline, fontSize: 13, color: Colors.secondary },
  actTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 2 },

  // Trophy chip
  trophyChip: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  trophyChipText: { fontSize: 14 },

  // Top Members cards
  memberCard: {
    width: 130,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberCardGold: {
    backgroundColor: '#FFFBEF',
    borderColor: 'rgba(201,168,76,0.35)',
  },
  memberCardCurrent: {
    borderColor: Colors.primaryFixed + '60',
  },
  memberAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberRank: { fontFamily: Fonts.title, fontSize: 10, letterSpacing: 0.5 },
  memberName: { fontFamily: Fonts.headline, fontSize: 11, color: Colors.onSurface, textAlign: 'center' },
  memberAmount: { fontFamily: Fonts.title, fontSize: 10 },

  // Next deadline
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
    ...Shadow.card,
  },
  nextCardIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  nextAmountWrap: { alignItems: 'flex-end' },
  nextAmount: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.primary },
  nextAmountUnit: { fontFamily: Fonts.label, fontSize: 10, color: Colors.textMuted },

  // Join group
  joinGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLow,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
  },
  joinGroupBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.primary },

  // Empty state
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 32, lineHeight: 21 },
  joinBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 28,
    ...Shadow.fab,
  },
  joinBigBtnText: { fontFamily: Fonts.headline, color: '#FFF', fontSize: 15 },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 28,
    paddingBottom: 52,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, marginBottom: 6 },
  modalSub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  codeInput: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontFamily: Fonts.headline,
    fontSize: 24,
    color: Colors.onSurface,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
  },
  errorText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.error, marginBottom: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  modalBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
  },
  modalBtnCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant, fontSize: 14 },
  modalBtnConfirm: {
    flex: 2,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalBtnConfirmText: { fontFamily: Fonts.headline, color: '#FFF', fontSize: 15 },
});

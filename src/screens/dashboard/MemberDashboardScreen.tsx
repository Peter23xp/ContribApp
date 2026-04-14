import { MaterialCommunityIcons } from '@expo/vector-icons';
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

// ─── Hero Card : PAYÉ ─────────────────────────────────────────────────────────
function HeroCardPaid({ contribution, checkAnim }: { contribution: any; checkAnim: Animated.Value }) {
  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] });
  return (
    <View style={[s.heroCard, s.heroCardPaid]}>
      <View style={s.heroCardRow}>
        <Text style={[s.heroTitle, { color: '#1b5e20' }]}>Contribution payée !</Text>
        <View style={[s.badge, { backgroundColor: '#a5d6a7' }]}>
          <Text style={[s.badgeText, { color: '#1b5e20' }]}>PAYÉ</Text>
        </View>
      </View>
      <Animated.View style={{ transform: [{ scale }], alignSelf: 'center', marginVertical: 12 }}>
        <MaterialCommunityIcons name="check-circle" size={56} color="#27ae60" />
      </Animated.View>
      <Text style={[s.heroDetail, { color: '#1b5e20' }]}>Montant : {(contribution?.amount ?? 0).toLocaleString('fr-FR')} CDF</Text>
      {contribution?.paid_at && (
        <Text style={[s.heroDetail, { color: '#388e3c' }]}>
          Date de paiement : {new Date(contribution.paid_at).toLocaleDateString('fr-FR')}
        </Text>
      )}
      <TouchableOpacity style={s.heroLink}>
        <Text style={[s.heroLinkText, { color: '#27ae60' }]}>Voir le reçu →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Hero Card : EN ATTENTE ───────────────────────────────────────────────────
function HeroCardPending({ contribution, daysLeft, navigation }: { contribution: any; daysLeft: number; navigation: any }) {
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
      <View style={s.heroCardRow}>
        <Text style={[s.heroTitle, { color: '#e65100' }]}>Contribution à payer</Text>
        <View style={[s.badge, { backgroundColor: '#ffe0b2' }]}>
          <Text style={[s.badgeText, { color: '#e65100' }]}>EN ATTENTE</Text>
        </View>
      </View>
      <Text style={[s.heroAmount, { color: '#e65100', marginTop: 12 }]}>
        {(contribution?.amount ?? 0).toLocaleString('fr-FR')} CDF
      </Text>
      <Animated.Text style={[s.heroCountdown, { color: isUrgent ? Colors.error : '#e65100', opacity: isUrgent ? pulseAnim : 1 }]}>
        Il vous reste {daysLeft} jour{daysLeft !== 1 ? 's' : ''}
      </Animated.Text>
      <TouchableOpacity style={s.payNowBtn} activeOpacity={0.85} onPress={() => navigation?.navigate('Payer')}>
        <MaterialCommunityIcons name="cash-multiple" size={20} color="#FFF" />
        <Text style={s.payNowBtnText}>PAYER MAINTENANT</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Hero Card : EN RETARD ────────────────────────────────────────────────────
function HeroCardLate({ contribution, navigation }: { contribution: any; navigation: any }) {
  const base = contribution?.amount ?? 0;
  const penalty = contribution?.penalty_amount ?? 0;
  const total = base + penalty;
  return (
    <View style={[s.heroCard, s.heroCardLate]}>
      <View style={s.heroCardRow}>
        <Text style={[s.heroTitle, { color: '#b71c1c' }]}>Contribution en retard !</Text>
        <View style={[s.badge, { backgroundColor: '#ffcdd2' }]}>
          <Text style={[s.badgeText, { color: '#b71c1c' }]}>EN RETARD</Text>
        </View>
      </View>
      <Text style={[s.heroDetail, { color: Colors.onSurface, marginTop: 12 }]}>
        Montant de base : {base.toLocaleString('fr-FR')} CDF
      </Text>
      {penalty > 0 && (
        <>
          <View style={s.heroDetailRow}>
            <MaterialCommunityIcons name="alert" size={14} color={Colors.error} />
            <Text style={[s.heroDetail, { color: Colors.error }]}>
              Pénalité de retard : +{penalty.toLocaleString('fr-FR')} CDF
            </Text>
          </View>
          <View style={s.heroDivider} />
          <Text style={[s.heroAmount, { color: Colors.error }]}>
            TOTAL À PAYER : {total.toLocaleString('fr-FR')} CDF
          </Text>
        </>
      )}
      <TouchableOpacity
        style={[s.payNowBtn, { backgroundColor: penalty > 0 ? Colors.error : Colors.warning }]}
        activeOpacity={0.85}
        onPress={() => navigation?.navigate('Payer')}
      >
        <MaterialCommunityIcons name="cash-multiple" size={20} color="#FFF" />
        <Text style={s.payNowBtnText}>
          {penalty > 0 ? 'PAYER MAINTENANT (avec pénalité)' : 'PAYER MAINTENANT'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ÉCRAN PRINCIPAL ──────────────────────────────────────────────────────────
export default function MemberDashboardScreen({ navigation }: any) {
  const user = useAuthStore(st => st.user);
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
    const g = await db.getGroupForMember(user.id);
    setGroup(g);
    if (g) {
      const c = await db.getMemberContribution(user.id, g.id);
      setContribution(c);
      const allC = await db.getContributionsForMonth(g.id);
      setGroupProgress({ paid: allC.filter((x: any) => x.status === 'PAYE').length, total: allC.length });
      const recent = await db.getRecentPaymentsForMember(user.id, 3);
      setRecentPayments(recent);
      const members = await db.getMembersOfGroup(g.id);
      const ranking = members
        .map((m: any) => {
          const paid = allC.filter((x: any) => x.user_id === m.id && x.status === 'PAYE');
          const totalPaid = paid.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
          return {
            id: m.id,
            full_name: m.full_name,
            totalPaid,
            paidCount: paid.length,
            isCurrentUser: m.id === user.id,
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
    setIsLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (contribution?.status === 'PAYE') {
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
      const alreadyIn = await db.isAlreadyMember(user.id, foundGroup.id);
      if (alreadyIn) { setJoinError('Vous êtes déjà membre.'); setJoining(false); return; }
      await db.joinGroup(user.id, foundGroup.id);
      setShowJoinModal(false); setInviteCode('');
      Toast.show({ type: 'success', text1: 'Bienvenue !', text2: `Vous avez rejoint "${foundGroup.name}".` });
      loadData();
    } catch { setJoinError('Erreur. Réessayez.'); }
    finally { setJoining(false); }
  };

  const status = contribution?.status ?? null;
  const dueDay = group?.due_day ?? 25;
  const dueMonthLabel = new Date().toLocaleDateString('fr-FR', { month: 'short' });
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);

  const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() - 1, dueDay);
  const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / 86400000));

  // Couleur barre groupe selon %
  const paidPct = groupProgress.total > 0 ? groupProgress.paid / groupProgress.total : 0;
  const progressBarColor = paidPct >= 0.9 ? Colors.secondary : paidPct >= 0.5 ? Colors.tertiary : Colors.warning;
  const totalBalance = groupProgress.paid * (group?.monthly_amount ?? 0);

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!isLoading && !group) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <TopBar />
        <View style={s.emptyBody}>
          <MaterialCommunityIcons name="account-group-outline" size={72} color={Colors.outlineVariant} />
          <Text style={s.emptyTitle}>Pas encore de groupe</Text>
          <Text style={s.emptySub}>Rejoignez un groupe pour commencer à cotiser.</Text>
          <TouchableOpacity style={s.joinBigBtn} onPress={() => setShowJoinModal(true)}>
            <MaterialCommunityIcons name="account-group" size={18} color="#FFF" />
            <Text style={s.joinBigBtnText}>Rejoindre un groupe</Text>
          </TouchableOpacity>
        </View>

        {/* Join Modal */}
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
      <TopBar />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance ─────────────────────────────────────────────────── */}
        <View style={s.balanceSection}>
          <Text style={s.balLabel}>TOTAL GROUP BALANCE</Text>
          <View style={s.balRow}>
            <Text style={s.balAmount}>
              {isLoading ? '—' : totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 3 })}
            </Text>
            <Text style={s.balCurrency}> CDF</Text>
          </View>

          {/* 2 status cards */}
          <View style={s.statusGrid}>
            <View style={s.statusCard}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={status === 'PAYE' ? Colors.secondary : status === 'EN_RETARD' ? Colors.error : Colors.warning}
                style={{ marginBottom: 12 }}
              />
              <Text style={s.statusLabel}>YOUR STATUS</Text>
              <Text style={[s.statusValue, {
                color: status === 'PAYE' ? Colors.secondary : status === 'EN_RETARD' ? Colors.error : Colors.warning
              }]}>
                {status === 'PAYE' ? 'Paid' : status === 'EN_ATTENTE' ? 'Pending' : status === 'EN_RETARD' ? 'Late' : '—'}
              </Text>
            </View>
            <View style={s.statusCard}>
              <MaterialCommunityIcons name="calendar-today" size={24} color={Colors.tertiary} style={{ marginBottom: 12 }} />
              <Text style={s.statusLabel}>NEXT DEADLINE</Text>
              <Text style={[s.statusValue, { color: Colors.onSurface }]}>{dueDay} {dueMonthLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── HERO CARD selon statut ─────────────────────────────────── */}
        {isLoading ? (
          <View style={[s.skeleton, { height: 180, marginBottom: 24 }]} />
        ) : status === 'PAYE' ? (
          <HeroCardPaid contribution={contribution} checkAnim={checkAnim} />
        ) : status === 'EN_RETARD' ? (
          <HeroCardLate contribution={contribution} navigation={navigation} />
        ) : (
          <HeroCardPending contribution={contribution} daysLeft={daysLeft} navigation={navigation} />
        )}

        {/* ── Pay Now (quand EN_ATTENTE + pas de Hero Card déjà) ──────── */}
        {!status && (
          <TouchableOpacity style={s.payBtn} activeOpacity={0.88} onPress={() => navigation?.navigate('Payer')}>
            <MaterialCommunityIcons name="cash-multiple" size={22} color="#FFF" />
            <Text style={s.payBtnText}>Pay Now</Text>
          </TouchableOpacity>
        )}

        {/* ── Widget : Progression du groupe ─────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Progression du groupe</Text>
          <Text style={s.cardSub}>
            {groupProgress.paid} membres ont déjà payé sur {groupProgress.total}
          </Text>
          <View style={{ marginTop: 12 }}>
            <ProgressBar
              current={groupProgress.paid}
              total={groupProgress.total || 1}
              color={progressBarColor}
              height={10}
            />
          </View>
          {groupProgress.total - groupProgress.paid > 0 && (
            <Text style={s.cardSub2}>{groupProgress.total - groupProgress.paid} membres restants</Text>
          )}
        </View>

        {/* ── Latest Activity ─────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Latest Activity</Text>
            <TouchableOpacity><Text style={s.seeAll}>View All</Text></TouchableOpacity>
          </View>
          <View style={s.activityContainer}>
            {isLoading ? (
              <><View style={s.skeleton} /><View style={s.skeleton} /></>
            ) : recentPayments.length === 0 ? (
              <Text style={s.emptyText}>Aucun paiement enregistré pour le moment.</Text>
            ) : (
              recentPayments.map((p: any, i: number) => (
                <TouchableOpacity key={p.id ?? i} style={s.actItem} activeOpacity={0.7}>
                  <View style={s.actAvatarWrap}>
                    <Avatar name={p.full_name ?? user?.full_name ?? '?'} size={48} bg={Colors.surfaceVariant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actName}>{p.full_name ?? user?.full_name ?? '—'}</Text>
                    <Text style={s.actSub}>Paid full contribution</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.actAmount}>+{Math.round((p.amount ?? 0) / 1000)}k</Text>
                    <Text style={s.actTime}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'Ce mois'}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
          <TouchableOpacity style={s.viewAllLink} onPress={() => navigation.navigate('Historique')}>
            <Text style={[s.seeAll, { textAlign: 'center', marginTop: 10 }]}>Voir tout mon historique →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Top Members ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Top Members</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {topMembers.length === 0 ? (
              <View style={s.memberCard}>
                <Text style={s.memberName}>Aucune donnée</Text>
              </View>
            ) : (
              topMembers.map((member: any, index: number) => (
                <View key={member.id ?? index} style={s.memberCard}>
                  <View style={[s.memberAvatarWrap, { backgroundColor: member.isCurrentUser ? Colors.primaryFixed + '60' : Colors.surfaceContainerHigh }]}>
                    {index === 0 ? (
                      <MaterialCommunityIcons name="medal" size={30} color={Colors.primary} />
                    ) : (
                      <Avatar name={member.full_name ?? '?'} size={42} bg={Colors.surfaceContainer} />
                    )}
                  </View>
                  <Text style={s.memberName} numberOfLines={1}>
                    {member.isCurrentUser ? 'Vous' : member.full_name}
                  </Text>
                  <View style={[s.memberBadge, { backgroundColor: Colors.secondary + '18' }]}>
                    <Text style={[s.memberBadgeText, { color: Colors.secondary }]}>
                      #{index + 1} • {Math.round(member.totalPaid).toLocaleString('fr-FR')} CDF
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── Prochaine échéance (masqué si EN_RETARD) ─────────────── */}
        {group && status !== 'EN_RETARD' && (
          <View style={s.nextCard}>
            <View style={s.nextCardIcon}>
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>
                {nextMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </Text>
              <Text style={s.cardSub}>
                À payer avant le {dueDay} {nextMonth.toLocaleDateString('fr-FR', { month: 'short' })}
              </Text>
            </View>
            <Text style={s.nextAmount}>{(group.monthly_amount ?? 0).toLocaleString('fr-FR')} CDF</Text>
          </View>
        )}

        {/* Rejoindre un groupe si QUAND MÊME pas de groupe */}
        <TouchableOpacity style={s.joinGroupBtn} onPress={() => setShowJoinModal(true)}>
          <MaterialCommunityIcons name="account-group" size={18} color={Colors.primary} />
          <Text style={s.joinGroupBtnText}>Rejoindre un autre groupe</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
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
        <MaterialCommunityIcons name="ticket-percent-outline" size={44} color={Colors.primary} style={{ marginBottom: 12 }} />
        <Text style={s.modalTitle}>Code d'invitation</Text>
        <Text style={s.modalSub}>Entrez le code fourni par l'administrateur du groupe.</Text>
        <Text style={s.hintCode}>Ex : ABC123</Text>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={onChangeCode}
          placeholder="Code d'invitation"
          placeholderTextColor={Colors.textMuted}
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
            {joining ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.modalBtnConfirmText}>Rejoindre</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
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
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },

  // Balance
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

  // Hero Cards
  heroCard: { borderRadius: Radius.xl, padding: 20, marginBottom: 24, borderWidth: 1.5 },
  heroCardPaid: { backgroundColor: '#e8f8ef', borderColor: '#27ae60' },
  heroCardPending: { backgroundColor: '#fff3e0', borderColor: '#f39c12' },
  heroCardLate: { backgroundColor: '#fdedec', borderColor: '#e74c3c' },
  heroCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontFamily: Fonts.headline, fontSize: 16, flex: 1, marginRight: 8 },
  heroAmount: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: -1, marginVertical: 8 },
  heroCountdown: { fontFamily: Fonts.headline, fontSize: 16, marginBottom: 16 },
  heroDetail: { fontFamily: Fonts.body, fontSize: 14, marginBottom: 4 },
  heroDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heroDivider: { height: 1, backgroundColor: '#ffcdd2', marginVertical: 10 },
  heroLink: { marginTop: 12 },
  heroLinkText: { fontFamily: Fonts.title, fontSize: 14, textDecorationLine: 'underline' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  badgeText: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '700' },

  // Pay Now
  payBtn: {
    height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 32, shadowColor: Colors.primary,
    shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  payBtnText: { fontFamily: Fonts.headline, fontSize: 17, color: '#FFF' },
  payNowBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
  },
  payNowBtnText: { fontFamily: Fonts.headline, fontSize: 15, color: '#FFF' },

  // Widgets
  card: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 20, marginBottom: 24, ...Shadow.card,
  },
  cardTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface, marginBottom: 4 },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant, marginBottom: 4 },
  cardSub2: { fontFamily: Fonts.body, fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 6 },

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
  viewAllLink: { paddingBottom: 4 },

  // Top Members
  memberCard: {
    width: 140, backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl, padding: 16, alignItems: 'center', gap: 8,
  },
  memberAvatarWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  memberName: { fontFamily: Fonts.headline, fontSize: 12, color: Colors.onSurface },
  memberBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  memberBadgeText: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '700' },

  // Next deadline
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 16, marginBottom: 16, ...Shadow.card,
  },
  nextCardIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center',
  },
  nextAmount: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.primary },

  // Join group
  joinGroupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow, marginBottom: 16,
  },
  joinGroupBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.primary },

  // Empty state
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface, marginTop: 16, textAlign: 'center' },
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 6, textAlign: 'center', marginBottom: 28 },
  joinBigBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 16, paddingHorizontal: 28,
  },
  joinBigBtnText: { fontFamily: Fonts.headline, color: '#FFF', fontSize: 15 },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.55)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: 28, paddingBottom: 48, alignItems: 'center',
  },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, marginBottom: 6 },
  modalSub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 4 },
  hintCode: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary, marginBottom: 16 },
  codeInput: {
    width: '100%', backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 16,
    fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface,
    textAlign: 'center', letterSpacing: 4, marginBottom: 8,
  },
  errorText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.error, marginBottom: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  modalBtnCancel: {
    flex: 1, padding: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center',
  },
  modalBtnCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant },
  modalBtnConfirm: {
    flex: 2, padding: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalBtnConfirmText: { fontFamily: Fonts.headline, color: '#FFF' },
});

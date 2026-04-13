import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { MonthStatusRow, ProgressBar } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';
import {
  fetchContributionDetail,
  fetchMemberHistoryByYear,
  type ContributionDetail,
  type MemberYearHistoryResponse,
} from '../../services/contributionService';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedHistory {
  cachedAt: number;
  data: MemberYearHistoryResponse;
}

type SheetType = 'paid' | 'late' | 'missing' | null;

export default function MyHistoryScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [history, setHistory] = useState<MemberYearHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MemberYearHistoryResponse['months'][number] | null>(null);
  const [sheetType, setSheetType] = useState<SheetType>(null);
  const [detail, setDetail] = useState<ContributionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({
    paidMonths: 0,
    totalPaid: 0,
    streak: 0,
    punctualityRate: 0,
    bestStreak: 0,
  });

  const countAnim = useRef(new Animated.Value(0)).current;

  const group = useMemo(() => {
    if (!user?.id) return null;
    return db.getGroupForMember(user.id);
  }, [user?.id]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOffline(!(state.isConnected ?? true)));
    return sub;
  }, []);

  useEffect(() => {
    if (!history || fromCache) return;
    countAnim.setValue(0);
    Animated.timing(countAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [history, fromCache, countAnim]);

  useEffect(() => {
    if (!history) {
      setAnimatedStats({ paidMonths: 0, totalPaid: 0, streak: 0, punctualityRate: 0, bestStreak: 0 });
      return;
    }
    if (fromCache) {
      setAnimatedStats({
        paidMonths: history.summary.paidMonths,
        totalPaid: history.summary.totalPaid,
        streak: history.stats.streak,
        punctualityRate: history.stats.punctualityRate,
        bestStreak: history.stats.bestStreak,
      });
      return;
    }

    const id = countAnim.addListener(({ value }) => {
      setAnimatedStats({
        paidMonths: Math.round(history.summary.paidMonths * value),
        totalPaid: Math.round(history.summary.totalPaid * value),
        streak: Math.round(history.stats.streak * value),
        punctualityRate: Math.round(history.stats.punctualityRate * value),
        bestStreak: Math.round(history.stats.bestStreak * value),
      });
    });
    return () => countAnim.removeListener(id);
  }, [countAnim, history, fromCache]);

  useEffect(() => {
    async function loadHistory() {
      if (!user?.id || !group?.id) return;
      setIsLoading(true);
      const cacheKey = `member_history_${selectedYear}`;

      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached: CachedHistory = JSON.parse(cachedRaw);
          if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            setHistory(cached.data);
            setFromCache(true);
            if (isOffline) {
              setIsLoading(false);
              return;
            }
          }
        }

        const fresh = await fetchMemberHistoryByYear(group.id, user.id, selectedYear);
        setHistory(fresh);
        setFromCache(false);
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ cachedAt: Date.now(), data: fresh } satisfies CachedHistory),
        );
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Impossible de charger votre historique.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [selectedYear, user?.id, group?.id, isOffline]);

  const displayedPaidMonths = fromCache ? history?.summary.paidMonths ?? 0 : animatedStats.paidMonths;
  const displayedTotalPaid = fromCache ? history?.summary.totalPaid ?? 0 : animatedStats.totalPaid;
  const displayedStreak = fromCache ? history?.stats.streak ?? 0 : animatedStats.streak;
  const displayedPunctualityRate = fromCache ? history?.stats.punctualityRate ?? 0 : animatedStats.punctualityRate;
  const displayedBestStreak = fromCache ? history?.stats.bestStreak ?? 0 : animatedStats.bestStreak;

  const punctualityColor =
    displayedPunctualityRate >= 90 ? Colors.secondary : displayedPunctualityRate >= 70 ? Colors.warning : Colors.error;

  const onMonthPress = async (month: MemberYearHistoryResponse['months'][number]) => {
    setSelectedMonth(month);
    if (month.status === 'PAYE' && month.txId) {
      setSheetType('paid');
      setDetailLoading(true);
      setDetail(null);
      try {
        const result = await fetchContributionDetail(month.txId);
        setDetail(result);
      } catch {
        Toast.show({ type: 'error', text1: 'Détail indisponible' });
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (month.status === 'EN_RETARD') {
      setSheetType('late');
      return;
    }

    if (month.status === 'MANQUANT' && !month.isFuture) {
      setSheetType('missing');
      return;
    }
  };

  const closeSheet = () => {
    setSheetType(null);
    setSelectedMonth(null);
    setDetail(null);
    setDetailLoading(false);
  };

  const yearMin = (history?.months.find((m) => m.status !== 'AVANT_INSCRIPTION')?.month ?? `${selectedYear}-01`)
    .split('-')
    .map(Number)[0];
  const yearMax = new Date().getFullYear();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon historique</Text>
      </View>

      <View style={styles.yearSelectorWrap}>
        <TouchableOpacity
          style={styles.yearArrow}
          onPress={() => setSelectedYear((y) => y - 1)}
          disabled={selectedYear <= yearMin}
        >
          <Text style={[styles.yearArrowText, selectedYear <= yearMin && styles.disabled]}>←</Text>
        </TouchableOpacity>
        <Text style={styles.yearValue}>{selectedYear}</Text>
        <TouchableOpacity
          style={styles.yearArrow}
          onPress={() => setSelectedYear((y) => y + 1)}
          disabled={selectedYear >= yearMax}
        >
          <Text style={[styles.yearArrowText, selectedYear >= yearMax && styles.disabled]}>→</Text>
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
          <Text style={styles.offlineText}>Mode hors-ligne — données en cache affichées</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonList} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resume {selectedYear}</Text>
            <Text style={styles.rowText}>
              {displayedPaidMonths} mois payes sur {history?.summary.totalMonthsAsMember ?? 0}
            </Text>
            <ProgressBar current={displayedPaidMonths} total={history?.summary.totalMonthsAsMember ?? 0} showLabel={false} />
            <Text style={styles.totalPaid}>
              Total verse : {displayedTotalPaid.toLocaleString('fr-FR')} {history?.summary.currency ?? 'CDF'}
            </Text>
            {history &&
              history.summary.totalMonthsAsMember > 0 &&
              history.summary.paidMonths === history.summary.totalMonthsAsMember && (
                <View style={styles.badgePerfect}>
                  <Text style={styles.badgePerfectText}>🏆 Aucun retard cette annee !</Text>
                </View>
              )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mes statistiques</Text>
            <View style={styles.grid}>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Serie en cours</Text>
                <Text style={styles.cellValue}>
                  {displayedStreak} mois {displayedStreak >= 3 ? '🔥' : ''}
                </Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Ponctualite</Text>
                <Text style={[styles.cellValue, { color: punctualityColor }]}>{displayedPunctualityRate}%</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Meilleure serie</Text>
                <Text style={styles.cellValue}>{displayedBestStreak} mois</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Cette annee</Text>
                <Text style={styles.cellValue}>
                  {displayedPaidMonths}/{history?.summary.totalMonthsAsMember ?? 0} payes
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mois {selectedYear}</Text>
            {history?.months.map((month) => (
              <MonthStatusRow
                key={month.month}
                month={month.month}
                status={month.status}
                amount={month.amount}
                currency={history.summary.currency}
                onPress={() => onMonthPress(month)}
                isFuture={month.isFuture}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <Modal visible={!!sheetType} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          <Pressable style={styles.sheet}>
            {sheetType === 'paid' && (
              <>
                <Text style={styles.sheetTitle}>Detail du paiement</Text>
                {detailLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : detail ? (
                  <>
                    <Text style={styles.sheetText}>Date: {detail.paidAt ? new Date(detail.paidAt).toLocaleString('fr-FR') : '-'}</Text>
                    <Text style={styles.sheetText}>Montant: {detail.amount.toLocaleString('fr-FR')} CDF</Text>
                    {detail.penaltyAmount > 0 && (
                      <Text style={styles.sheetText}>Penalite: {detail.penaltyAmount.toLocaleString('fr-FR')} CDF</Text>
                    )}
                    <Text style={styles.sheetText}>Operateur: {detail.operator ?? '-'}</Text>
                    <Text style={styles.txRef}>{detail.txReference}</Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => {
                        closeSheet();
                        navigation.navigate('Receipt', { txId: detail.txId });
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Voir le recu complet</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            )}

            {sheetType === 'late' && (
              <>
                <Text style={styles.sheetTitle}>Paiement en retard</Text>
                <Text style={styles.sheetText}>
                  Votre contribution de {selectedMonth?.month ?? ''} est en retard.
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    closeSheet();
                    navigation.navigate('Main', { screen: 'Payer' });
                  }}
                >
                  <Text style={styles.primaryBtnText}>Payer maintenant</Text>
                </TouchableOpacity>
              </>
            )}

            {sheetType === 'missing' && (
              <>
                <Text style={styles.sheetTitle}>Contribution manquante</Text>
                <Text style={styles.sheetText}>
                  Vous n avez pas paye pour {selectedMonth?.month ?? ''}. Contactez votre admin si c est une erreur.
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingTop: 42, paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface },
  yearSelectorWrap: {
    width: 180,
    alignSelf: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    ...Shadow.card,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  yearArrow: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  yearArrowText: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface },
  disabled: { opacity: 0.35 },
  yearValue: { fontFamily: Fonts.title, fontSize: 18, color: Colors.onSurface },
  offlineBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.offline,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: { fontFamily: Fonts.body, fontSize: 12, color: '#795501' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, ...Shadow.card },
  cardTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.onSurface, marginBottom: 10 },
  rowText: { fontFamily: Fonts.body, color: Colors.onSurfaceVariant, marginBottom: 8 },
  totalPaid: { marginTop: 10, fontFamily: Fonts.headline, color: Colors.secondary, fontSize: 16 },
  badgePerfect: {
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: Colors.secondaryContainer,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgePerfectText: { fontFamily: Fonts.title, color: Colors.secondary, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '50%' },
  cellLabel: { fontFamily: Fonts.body, color: Colors.textMuted, fontSize: 12 },
  cellValue: { fontFamily: Fonts.headline, color: Colors.onSurface, fontSize: 16, marginTop: 2 },
  skeletonWrap: { padding: 16, gap: 12 },
  skeletonCard: { height: 130, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh },
  skeletonList: { height: 380, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh },
  sheetBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 18,
    paddingBottom: 28,
    gap: 10,
  },
  sheetTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  sheetText: { fontFamily: Fonts.body, color: Colors.onSurfaceVariant },
  txRef: { fontFamily: 'Courier', color: Colors.onSurface, fontSize: 12 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  primaryBtnText: { fontFamily: Fonts.headline, color: '#FFF' },
});

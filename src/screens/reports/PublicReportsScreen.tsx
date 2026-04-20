import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { MonthPickerSelector, ReportSummaryCard, StatusBadge } from '../../components/common';
import { fetchMonthlyReport, type MonthlyReportResponse } from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';
import { fetchGroupConfig } from '../../services/groupService';

const CACHE_TTL = 24 * 60 * 60 * 1000;

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export default function PublicReportsScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [paymentsVisible, setPaymentsVisible] = useState(false);
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);

  const groupId = useAuthStore((s) => s.groupId);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOffline(!(state.isConnected ?? true)));
    return unsub;
  }, []);

  useEffect(() => {
    async function load() {
      if (!groupId) return;
      setIsLoading(true);
      const cacheKey = `public_reports_${groupId}_${selectedMonth}`;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { cachedAt: number; report: MonthlyReportResponse; paymentsVisible: boolean };
          if (Date.now() - parsed.cachedAt < CACHE_TTL) {
            setReport(parsed.report);
            setPaymentsVisible(parsed.paymentsVisible);
            if (isOffline) {
              setIsLoading(false);
              return;
            }
          }
        }

        const [reportData, groupConfig] = await Promise.all([
          fetchMonthlyReport(groupId, selectedMonth),
          fetchGroupConfig(groupId),
        ]);
        setReport(reportData);
        setPaymentsVisible(groupConfig.paymentsVisible);
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ cachedAt: Date.now(), report: reportData, paymentsVisible: groupConfig.paymentsVisible }),
        );
      } catch {
        Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les statistiques.' });
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [groupId, selectedMonth, isOffline]);

  const myContribution = useMemo(() => {
    if (!report || !user?.id) return null;
    return report.contributions.find((c) => c.memberId === user.id) ?? null;
  }, [report, user?.id]);

  const paidCount = report?.summary.paidCount ?? 0;
  const pendingCount = Math.max(0, (report?.summary.totalMembers ?? 0) - paidCount);

  const pieData = [
    {
      name: 'Payes',
      population: paidCount,
      color: Colors.secondary,
      legendFontColor: Colors.onSurface,
      legendFontSize: 12,
    },
    {
      name: 'En attente/retard',
      population: pendingCount,
      color: Colors.warning,
      legendFontColor: Colors.onSurface,
      legendFontSize: 12,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistiques du groupe</Text>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
          <Text style={styles.offlineText}>Mode hors-ligne — donnees du cache</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <MonthPickerSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} maxMonth={toMonthKey(new Date())} />

        {isLoading || !report ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : (
          <>
            <ReportSummaryCard
              expectedAmount={report.summary.expectedAmount}
              collectedAmount={report.summary.collectedAmount}
              missingAmount={report.summary.missingAmount}
              participationRate={report.summary.participationRate}
              currency="CDF"
              period={report.period}
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Repartition globale</Text>
              <PieChart
                data={pieData}
                width={320}
                height={220}
                chartConfig={{
                  color: () => Colors.onSurface,
                  labelColor: () => Colors.onSurface,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="12"
                center={[0, 0]}
                hasLegend
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ma contribution ce mois</Text>
              {myContribution?.status === 'PAYE' ? (
                <View style={styles.personalPaidCard}>
                  <Text style={styles.personalMain}>
                    {Math.round(myContribution.amount).toLocaleString('fr-FR')} CDF
                  </Text>
                  <Text style={styles.personalSub}>
                    Paye le {myContribution.paidAt ? new Date(myContribution.paidAt).toLocaleDateString('fr-FR') : '-'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Receipt', { txId: myContribution.txId })}
                  >
                    <Text style={styles.linkBtn}>Voir mon recu</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.personalPendingCard}>
                  <Text style={styles.personalPendingText}>Votre contribution n est pas encore payee.</Text>
                  <TouchableOpacity style={styles.payNowBtn} onPress={() => navigation.navigate('Main', { screen: 'Payer' })}>
                    <Text style={styles.payNowText}>Payer maintenant</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Liste des membres</Text>
              {paymentsVisible ? (
                report.contributions.map((c) => (
                  <View key={`${c.memberId}_${c.txId}`} style={styles.memberRow}>
                    <Text style={styles.memberName}>{c.memberName}</Text>
                    <StatusBadge status={c.status} />
                  </View>
                ))
              ) : (
                <Text style={styles.aggregateOnlyText}>
                  {paidCount} membres ont paye, {pendingCount} membres sont en attente.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 16, paddingTop: 42, paddingBottom: 10 },
  headerTitle: { fontFamily: Fonts.headline, fontSize: 22, color: Colors.onSurface },
  offlineBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.offline,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: { fontFamily: Fonts.body, fontSize: 12, color: '#795501' },
  content: { paddingHorizontal: 16, paddingBottom: 26, gap: 12 },
  skeletonWrap: { gap: 12 },
  skeletonCard: { height: 120, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 12, ...Shadow.card },
  cardTitle: { fontFamily: Fonts.headline, color: Colors.onSurface, marginBottom: 8, fontSize: 15 },
  personalPaidCard: { borderRadius: Radius.md, backgroundColor: '#E8F8EF', padding: 12, gap: 4 },
  personalMain: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.secondary },
  personalSub: { fontFamily: Fonts.body, color: Colors.onSurfaceVariant, fontSize: 12 },
  linkBtn: { marginTop: 4, fontFamily: Fonts.title, color: Colors.primary, textDecorationLine: 'underline' },
  personalPendingCard: { borderRadius: Radius.md, backgroundColor: '#FFF4E5', padding: 12, gap: 8 },
  personalPendingText: { fontFamily: Fonts.body, color: Colors.warning },
  payNowBtn: { alignSelf: 'flex-start', borderRadius: Radius.full, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7 },
  payNowText: { color: '#FFF', fontFamily: Fonts.title, fontSize: 12 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '55',
    paddingVertical: 8,
  },
  memberName: { fontFamily: Fonts.body, color: Colors.onSurface },
  aggregateOnlyText: { fontFamily: Fonts.body, color: Colors.onSurfaceVariant },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { AppButton, MonthPickerSelector, ReportSummaryCard } from '../../components/common';
import { sendGroupRemindAll, type MonthlyReportResponse, type MonthlyStatPoint } from '../../services/contributionService';
import { exportReportExcel, exportReportPdf, fetchMonthlyReport, fetchYearMonthlyStats } from '../../services/contributionService';
import { useAuthStore } from '../../stores/authStore';

type ReportType = 'monthly' | 'quarterly' | 'yearly';
type ReportContribution = MonthlyReportResponse['contributions'][number];

const chartWidth = Math.min(360, Dimensions.get('window').width - 46);
const quarterLabel = ['T1 (Jan-Mar)', 'T2 (Avr-Jui)', 'T3 (Jui-Sep)', 'T4 (Oct-Dec)'];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function quarterMonths(year: number, quarter: number): string[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2].map((m) => `${year}-${`${m}`.padStart(2, '0')}`);
}

export default function ReportsScreen({ route, navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const groupId = useAuthStore((s) => s.groupId);

  const presetMonth: string | undefined = route?.params?.presetMonth;

  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>(presetMonth ? 'monthly' : 'monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(presetMonth ?? monthKey(now));
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportResponse | null>(null);
  const [yearStats, setYearStats] = useState<MonthlyStatPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  const periodKey = useMemo(() => {
    if (reportType === 'monthly') return selectedMonth;
    if (reportType === 'quarterly') return `${selectedYear}-Q${selectedQuarter}`;
    return `${selectedYear}`;
  }, [reportType, selectedMonth, selectedYear, selectedQuarter]);

  const cacheKey = useMemo(() => `reports_${reportType}_${periodKey}`, [reportType, periodKey]);
  const fileUrlCacheKey = useMemo(() => `report_url_cache_${reportType}_${periodKey}`, [reportType, periodKey]);

  const loadReport = async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setMonthlyData(parsed.monthlyData ?? null);
        setYearStats(parsed.yearStats ?? []);
      }

      if (isOffline && cached) {
        setIsLoading(false);
        return;
      }

      if (reportType === 'monthly') {
        const report = await fetchMonthlyReport(groupId, selectedMonth);
        setMonthlyData(report);
        setYearStats([]);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ monthlyData: report, yearStats: [] }));
      } else if (reportType === 'quarterly') {
        const months = quarterMonths(selectedYear, selectedQuarter);
        const reports = await Promise.all(months.map((m) => fetchMonthlyReport(groupId, m)));
        const aggregated: MonthlyReportResponse = {
          period: `${quarterLabel[selectedQuarter - 1]} ${selectedYear}`,
          summary: {
            expectedAmount: reports.reduce((a: number, r: any) => a + r.summary.expectedAmount, 0),
            collectedAmount: reports.reduce((a: number, r: any) => a + r.summary.collectedAmount, 0),
            missingAmount: reports.reduce((a: number, r: any) => a + r.summary.missingAmount, 0),
            participationRate: reports.length > 0 ? Math.round(reports.reduce((a: number, r: any) => a + r.summary.participationRate, 0) / reports.length) : 0,
            paidCount: reports.reduce((a: number, r: any) => a + r.summary.paidCount, 0),
            totalMembers: reports.reduce((a: number, r: any) => a + r.summary.totalMembers, 0),
            lateCount: reports.reduce((a: number, r: any) => a + r.summary.lateCount, 0),
          },
          contributions: reports.flatMap((r: any) => r.contributions),
          unpaidMembers: reports.flatMap((r: any) => r.unpaidMembers),
        };
        setMonthlyData(aggregated);
        setYearStats(
          reports.map((r: any, idx: number) => ({
            month: months[idx],
            collectedAmount: r.summary.collectedAmount,
            expectedAmount: r.summary.expectedAmount,
            paidCount: r.summary.paidCount,
            totalMembers: r.summary.totalMembers,
          })),
        );
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ monthlyData: aggregated, yearStats }));
      } else {
        const stats = await fetchYearMonthlyStats(groupId, selectedYear);
        setYearStats(stats);
        const annualSummary = {
          expectedAmount: stats.reduce((a: number, x: any) => a + x.expectedAmount, 0),
          collectedAmount: stats.reduce((a: number, x: any) => a + x.collectedAmount, 0),
          missingAmount: Math.max(0, stats.reduce((a: number, x: any) => a + x.expectedAmount, 0) - stats.reduce((a: number, x: any) => a + x.collectedAmount, 0)),
          participationRate: stats.length > 0 ? Math.round(stats.reduce((a: number, x: any) => a + (x.totalMembers > 0 ? x.paidCount / x.totalMembers : 0), 0) / stats.length * 100) : 0,
          paidCount: stats.reduce((a: number, x: any) => a + x.paidCount, 0),
          totalMembers: stats.reduce((a: number, x: any) => a + x.totalMembers, 0),
          lateCount: 0,
        };
        setMonthlyData({
          period: `${selectedYear}`,
          summary: annualSummary,
          contributions: [],
          unpaidMembers: [],
        });
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ monthlyData: { period: `${selectedYear}`, summary: annualSummary, contributions: [], unpaidMembers: [] }, yearStats: stats }));
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le rapport.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedMonth, selectedQuarter, selectedYear, groupId]);

  const contributionRows: ReportContribution[] = monthlyData?.contributions ?? [];
  const displayedRows = showAllRows ? contributionRows : contributionRows.slice(0, 10);

  const pieData = useMemo(() => {
    const paid = monthlyData?.summary.paidCount ?? 0;
    const late = monthlyData?.summary.lateCount ?? 0;
    const total = monthlyData?.summary.totalMembers ?? 0;
    const absent = Math.max(0, total - paid - late);
    return [
      { name: 'Payes', population: paid, color: Colors.secondary, legendFontColor: Colors.onSurface, legendFontSize: 12 },
      { name: 'En retard', population: late, color: Colors.error, legendFontColor: Colors.onSurface, legendFontSize: 12 },
      { name: 'Absents', population: absent, color: Colors.outlineVariant, legendFontColor: Colors.onSurface, legendFontSize: 12 },
    ];
  }, [monthlyData]);

  const barLabels = (yearStats.length ? yearStats : []).map((x) => x.month.split('-')[1]);
  const barData = (yearStats.length ? yearStats : []).map((x) => x.collectedAmount);

  const bestMonth = useMemo(() => {
    if (!yearStats.length) return null;
    return [...yearStats].sort((a, b) => b.collectedAmount - a.collectedAmount)[0];
  }, [yearStats]);

  const getOrCreatePdfUrl = async () => {
    const raw = await AsyncStorage.getItem(fileUrlCacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as { url: string; cachedAt: number };
      if (Date.now() - cached.cachedAt < 23 * 60 * 60 * 1000) {
        return cached.url;
      }
    }
    if (!groupId) throw new Error('No group');
    const { downloadUrl } = await exportReportPdf(groupId, reportType, periodKey);
    await AsyncStorage.setItem(fileUrlCacheKey, JSON.stringify({ url: downloadUrl, cachedAt: Date.now() }));
    return downloadUrl;
  };

  const onGeneratePdf = async () => {
    if (isOffline) return;
    setLoadingPdf(true);
    try {
      const url = await getOrCreatePdfUrl();
      setPdfModalUrl(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur PDF' });
    } finally {
      setLoadingPdf(false);
    }
  };

  const onExportExcel = async () => {
    if (!groupId || isOffline) return;
    setLoadingExcel(true);
    try {
      const { downloadUrl } = await exportReportExcel(groupId, reportType, periodKey);
      const destination = `${(FileSystem as any).documentDirectory ?? ''}rapport_${reportType}_${periodKey}.xlsx`;
      await FileSystem.downloadAsync(downloadUrl, destination);
      Toast.show({ type: 'success', text1: 'Fichier Excel sauvegarde' });
      await Sharing.shareAsync(destination);
    } catch {
      Toast.show({ type: 'error', text1: 'Export Excel impossible' });
    } finally {
      setLoadingExcel(false);
    }
  };

  const onShareDirect = async () => {
    if (isOffline) return;
    setLoadingShare(true);
    try {
      const url = await getOrCreatePdfUrl();
      const tmp = `${(FileSystem as any).cacheDirectory ?? ''}rapport_${reportType}_${periodKey}.pdf`;
      await FileSystem.downloadAsync(url, tmp);
      await Sharing.shareAsync(tmp, {
        dialogTitle: `Rapport ${reportType} - ${periodKey} - Groupe ${groupId ?? ''}`,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Partage impossible' });
    } finally {
      setLoadingShare(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <MaterialCommunityIcons name="bank" size={22} color="#004d40" />
          <Text style={styles.topBarTitle}>Rapports</Text>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#795501" />
          <Text style={styles.offlineText}>Mode hors-ligne - export desactive</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.segmentRow}>
          {[
            { key: 'monthly', label: 'Mensuel' },
            { key: 'quarterly', label: 'Trimestriel' },
            { key: 'yearly', label: 'Annuel' },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.segment, reportType === s.key && styles.segmentActive]}
              onPress={() => setReportType(s.key as ReportType)}
            >
              <Text style={[styles.segmentText, reportType === s.key && styles.segmentTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {reportType === 'monthly' && <MonthPickerSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} maxMonth={monthKey(new Date())} />}

        {reportType === 'quarterly' && (
          <View style={styles.periodRow}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => setSelectedQuarter((q) => (q > 1 ? q - 1 : 4))}>
              <Text>←</Text>
            </TouchableOpacity>
            <Text style={styles.periodText}>{quarterLabel[selectedQuarter - 1]} {selectedYear}</Text>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => setSelectedQuarter((q) => (q < 4 ? q + 1 : 1))}>
              <Text>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {reportType !== 'monthly' && (
          <View style={styles.periodRow}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => setSelectedYear((y) => y - 1)}>
              <Text>←</Text>
            </TouchableOpacity>
            <Text style={styles.periodText}>{selectedYear}</Text>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => setSelectedYear((y) => Math.min(new Date().getFullYear(), y + 1))}>
              <Text>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading || !monthlyData ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : (
          <>
            <ReportSummaryCard
              expectedAmount={monthlyData.summary.expectedAmount}
              collectedAmount={monthlyData.summary.collectedAmount}
              missingAmount={monthlyData.summary.missingAmount}
              participationRate={monthlyData.summary.participationRate}
              currency="CDF"
              period={monthlyData.period}
            />

            {reportType === 'monthly' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Repartition</Text>
                <PieChart
                  data={pieData}
                  width={chartWidth}
                  height={220}
                  chartConfig={{
                    color: () => Colors.onSurface,
                    labelColor: () => Colors.onSurface,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="16"
                  center={[0, 0]}
                  hasLegend
                />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Evolution collecte</Text>
                <BarChart
                  data={{ labels: barLabels, datasets: [{ data: barData.length ? barData : [0] }] }}
                  width={chartWidth}
                  height={220}
                  chartConfig={{
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: () => Colors.primary,
                    labelColor: () => Colors.onSurfaceVariant,
                    fillShadowGradient: Colors.primary,
                    fillShadowGradientOpacity: 0.8,
                  }}
                  style={{ borderRadius: 12 }}
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                />
                {reportType === 'yearly' && bestMonth && (
                  <Text style={styles.bestMonthText}>
                    Meilleur mois: {bestMonth.month} - {Math.round(bestMonth.collectedAmount).toLocaleString('fr-FR')} CDF
                  </Text>
                )}
              </View>
            )}

            {reportType !== 'yearly' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Tableau detaille</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 2 }]}>Membre</Text>
                  <Text style={styles.th}>Montant</Text>
                  <Text style={styles.th}>Oper.</Text>
                  <Text style={styles.th}>Date</Text>
                  <Text style={styles.th}>Statut</Text>
                </View>
                <FlatList
                  data={displayedRows}
                  keyExtractor={(item) => `${item.txId}`}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.row}
                  onPress={() => item.status === 'PAYE' && navigation.navigate('Receipt', { txId: item.txId })}
                      disabled={item.status !== 'PAYE'}
                    >
                      <Text style={[styles.td, { flex: 2 }]}>{item.memberName}</Text>
                      <Text style={styles.td}>{Math.round(item.amount).toLocaleString('fr-FR')}</Text>
                      <Text style={styles.td}>{item.operator ?? '-'}</Text>
                      <Text style={styles.td}>{item.paidAt ? new Date(item.paidAt).toLocaleDateString('fr-FR') : '-'}</Text>
                      <Text style={styles.td}>{item.status}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>Aucune donnee pour cette periode.</Text>}
                />
                {contributionRows.length > 10 && (
                  <TouchableOpacity style={styles.showAllBtn} onPress={() => setShowAllRows((v) => !v)}>
                    <Text style={styles.showAllText}>{showAllRows ? 'Afficher moins' : 'Tout afficher'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Membres n ayant pas paye ({monthlyData.unpaidMembers.length})</Text>
              {monthlyData.unpaidMembers.map((u: any) => (
                <View key={`${u.memberId}_${u.memberName}`} style={styles.unpaidRow}>
                  <Text style={styles.unpaidName}>{u.memberName}</Text>
                  <Text style={styles.unpaidAmount}>{Math.round(u.amountDue).toLocaleString('fr-FR')} CDF</Text>
                </View>
              ))}
              {!monthlyData.unpaidMembers.length && <Text style={styles.emptyText}>Aucun membre impaye.</Text>}
              {role === 'admin' && monthlyData.unpaidMembers.length > 0 && (
                <TouchableOpacity
                  style={styles.remindAllBtn}
                  onPress={async () => {
                    if (!groupId) return;
                    await sendGroupRemindAll(groupId);
                    Toast.show({ type: 'success', text1: 'Rappels envoyes' });
                  }}
                >
                  <Text style={styles.remindAllText}>Envoyer rappel a tous</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.exportBar}>
        <AppButton
          title="Generer PDF"
          onPress={onGeneratePdf}
          loading={loadingPdf}
          disabled={isOffline || isLoading}
          style={{ flex: 1 }}
        />
        <AppButton
          title="Excel (.xlsx)"
          onPress={onExportExcel}
          variant="outline"
          loading={loadingExcel}
          disabled={isOffline || isLoading}
          style={{ flex: 1 }}
        />
        <AppButton
          title="Partager"
          onPress={onShareDirect}
          variant="outline"
          loading={loadingShare}
          disabled={isOffline || isLoading}
          style={styles.shareBtn}
        />
      </View>

      <Modal visible={!!pdfModalUrl} transparent animationType="fade" onRequestClose={() => setPdfModalUrl(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPdfModalUrl(null)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apercu PDF</Text>
            <Text style={styles.modalUrl} numberOfLines={2}>
              {pdfModalUrl}
            </Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              <AppButton
                title="Telecharger"
                onPress={async () => {
                  if (!pdfModalUrl) return;
                  const destination = `${(FileSystem as any).documentDirectory ?? ''}rapport_${reportType}_${periodKey}.pdf`;
                  await FileSystem.downloadAsync(pdfModalUrl, destination);
                  Toast.show({ type: 'success', text1: 'PDF sauvegarde' });
                }}
              />
              <AppButton
                title="Partager"
                variant="outline"
                onPress={async () => {
                  if (!pdfModalUrl) return;
                  const temp = `${(FileSystem as any).cacheDirectory ?? ''}rapport_preview_${periodKey}.pdf`;
                  await FileSystem.downloadAsync(pdfModalUrl, temp);
                  await Sharing.shareAsync(temp);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment: { flex: 1, borderRadius: Radius.full, paddingVertical: 8, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant, fontSize: 12 },
  segmentTextActive: { color: '#FFF' },
  periodRow: {
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 12,
  },
  arrowBtn: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  periodText: { fontFamily: Fonts.title, color: Colors.onSurface },
  skeletonWrap: { gap: 12 },
  skeletonCard: { height: 130, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 12, ...Shadow.card },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 15, color: Colors.onSurface, marginBottom: 8 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '55' },
  th: { flex: 1, fontFamily: Fonts.title, color: Colors.onSurfaceVariant, fontSize: 11 },
  td: { flex: 1, fontFamily: Fonts.body, color: Colors.onSurface, fontSize: 11 },
  showAllBtn: { marginTop: 10, alignSelf: 'center' },
  showAllText: { fontFamily: Fonts.title, color: Colors.primary },
  emptyText: { fontFamily: Fonts.body, color: Colors.textMuted, fontSize: 12 },
  unpaidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  unpaidName: { fontFamily: Fonts.body, color: Colors.onSurface },
  unpaidAmount: { fontFamily: Fonts.title, color: Colors.warning },
  remindAllBtn: { marginTop: 10, backgroundColor: Colors.secondaryContainer, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  remindAllText: { fontFamily: Fonts.title, color: Colors.secondary },
  exportBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 8,
    ...Shadow.card,
  },
  shareBtn: { flex: 0.9 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: 16, ...Shadow.card },
  modalTitle: { fontFamily: Fonts.headline, color: Colors.onSurface, fontSize: 16 },
  modalUrl: { marginTop: 8, fontFamily: Fonts.body, color: Colors.textMuted, fontSize: 12 },
  bestMonthText: { marginTop: 8, fontFamily: Fonts.title, color: Colors.primary },
});

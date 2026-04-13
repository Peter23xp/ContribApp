import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ProgressBar } from './ProgressBar';

interface Props {
  expectedAmount: number;
  collectedAmount: number;
  missingAmount: number;
  participationRate: number;
  currency: 'CDF' | 'USD';
  period: string;
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

function rateColor(rate: number): string {
  if (rate < 50) return Colors.error;
  if (rate < 90) return Colors.warning;
  return Colors.secondary;
}

export function ReportSummaryCard({
  expectedAmount,
  collectedAmount,
  missingAmount,
  participationRate,
  currency,
  period,
}: Props) {
  const safeRate = Math.max(0, Math.min(participationRate, 100));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Resume - {period}</Text>

      <View style={styles.grid}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Attendu</Text>
          <Text style={[styles.metricValue, styles.metricNeutral]}>
            {formatAmount(expectedAmount)} {currency}
          </Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Collecte</Text>
          <Text style={[styles.metricValue, styles.metricGreen]}>
            {formatAmount(collectedAmount)} {currency}
          </Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Manquant</Text>
          <Text style={[styles.metricValue, styles.metricRed]}>
            {formatAmount(Math.max(0, missingAmount))} {currency}
          </Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Participation</Text>
          <Text style={[styles.metricValue, styles.metricBlue]}>{Math.round(safeRate)}%</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <ProgressBar current={safeRate} total={100} color={rateColor(safeRate)} height={9} showLabel={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  metricCell: {
    width: '50%',
    paddingRight: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontFamily: Fonts.title,
    fontWeight: '700',
  },
  metricNeutral: {
    color: Colors.onSurfaceVariant,
  },
  metricGreen: {
    color: Colors.secondary,
  },
  metricRed: {
    color: Colors.error,
  },
  metricBlue: {
    color: Colors.tertiary,
  },
  progressWrap: {
    marginTop: 14,
  },
});

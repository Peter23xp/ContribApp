import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';

interface Props {
  collectedAmount: number;
  expectedAmount: number;
  currency: 'CDF' | 'USD';
  paidCount: number;
  totalMembers: number;
  completionRate: number;
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

export function SummaryBanner({
  collectedAmount,
  expectedAmount,
  currency,
  paidCount,
  totalMembers,
  completionRate,
}: Props) {
  const safeRate = Math.max(0, Math.min(completionRate, 100));

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.amountMain}>
          {formatAmount(collectedAmount)} {currency}
        </Text>
        <Text style={styles.amountSub}>
          sur {formatAmount(expectedAmount)} {currency}
        </Text>
      </View>

      <View style={styles.center}>
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${safeRate}%` }]} />
        </View>
        <Text style={styles.rateLabel}>{Math.round(safeRate)}%</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.memberMain}>
          {paidCount}/{totalMembers}
        </Text>
        <Text style={styles.memberSub}>membres</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E8F8EF',
    ...Shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  left: {
    flex: 1,
  },
  amountMain: {
    fontSize: 18,
    color: Colors.secondary,
    fontFamily: Fonts.headline,
    fontWeight: '800',
  },
  amountSub: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
  },
  center: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  track: {
    height: 48,
    width: 8,
    borderRadius: Radius.full,
    backgroundColor: '#CFE7D7',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    minHeight: 2,
  },
  rateLabel: {
    fontSize: 10,
    fontFamily: Fonts.label,
    color: Colors.onSurfaceVariant,
  },
  right: {
    minWidth: 68,
    alignItems: 'flex-end',
  },
  memberMain: {
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: Fonts.headline,
    fontWeight: '700',
  },
  memberSub: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
  },
});

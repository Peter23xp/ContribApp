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
      {/* Gold left accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.left}>
        <Text style={styles.amountMain}>
          {formatAmount(collectedAmount)}{' '}
          <Text style={styles.currency}>{currency}</Text>
        </Text>
        <Text style={styles.amountSub}>
          sur {formatAmount(expectedAmount)} {currency}
        </Text>
      </View>

      {/* Vertical divider */}
      <View style={styles.divider} />

      <View style={styles.center}>
        <View style={styles.rateCircle}>
          <Text style={styles.rateValue}>{Math.round(safeRate)}</Text>
          <Text style={styles.ratePct}>%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${safeRate}%` }]} />
        </View>
      </View>

      {/* Vertical divider */}
      <View style={styles.divider} />

      <View style={styles.right}>
        <Text style={styles.memberMain}>
          {paidCount}<Text style={styles.memberTotal}>/{totalMembers}</Text>
        </Text>
        <Text style={styles.memberSub}>membres payés</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: Colors.gold,
    marginRight: 14,
  },
  left: {
    flex: 1,
    paddingRight: 8,
  },
  currency: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  amountMain: {
    fontSize: 20,
    color: Colors.primary,
    fontFamily: Fonts.display,
    letterSpacing: -0.5,
  },
  amountSub: {
    marginTop: 3,
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: 12,
  },
  center: {
    alignItems: 'center',
    gap: 6,
  },
  rateCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rateValue: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.secondary,
  },
  ratePct: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.secondary,
  },
  track: {
    height: 32,
    width: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    minHeight: 2,
  },
  right: {
    minWidth: 72,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  memberMain: {
    fontSize: 20,
    color: Colors.onSurface,
    fontFamily: Fonts.display,
  },
  memberTotal: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  memberSub: {
    marginTop: 3,
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
  },
});

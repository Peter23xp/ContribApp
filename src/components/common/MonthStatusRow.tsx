import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

type MonthStatus = 'PAYE' | 'EN_RETARD' | 'MANQUANT' | 'AVANT_INSCRIPTION';

interface Props {
  month: string;
  status: MonthStatus;
  amount: number | null;
  currency: 'CDF' | 'USD';
  onPress: () => void;
  isFuture?: boolean;
}

const STATUS_THEME: Record<MonthStatus, { bg: string; text: string; label: string }> = {
  PAYE: { bg: Colors.secondaryContainer, text: Colors.secondary, label: 'PAYÉ' },
  EN_RETARD: { bg: Colors.errorContainer, text: Colors.error, label: 'EN RETARD' },
  MANQUANT: { bg: '#FFE8CC', text: '#B85C00', label: 'MANQUANT' },
  AVANT_INSCRIPTION: { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'Pas encore membre' },
};

function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-').map(Number);
  const date = new Date(year, monthPart - 1, 1);
  const raw = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('fr-FR');
}

export function MonthStatusRow({ month, status, amount, currency, onPress, isFuture = false }: Props) {
  const canPress = status === 'PAYE';
  const statusTheme = isFuture
    ? { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'A venir' }
    : STATUS_THEME[status];
  const displayedAmount = status === 'PAYE' && amount !== null ? `${formatAmount(amount)} ${currency}` : '-';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && canPress && styles.rowPressed]}
      onPress={canPress ? onPress : undefined}
    >
      <Text style={styles.monthText}>{formatMonthLabel(month)}</Text>

      <View style={[styles.badge, { backgroundColor: statusTheme.bg }]}>
        <Text style={[styles.badgeText, { color: statusTheme.text }]}>{statusTheme.label}</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, status === 'PAYE' ? styles.amountPaid : styles.amountMissing]}>{displayedAmount}</Text>
        {canPress && <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.onSurfaceVariant} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 10,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.sm,
  },
  monthText: {
    flex: 1,
    fontFamily: Fonts.body,
    color: Colors.onSurface,
    fontSize: 14,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
  },
  right: {
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  amount: {
    fontFamily: Fonts.title,
    fontSize: 13,
  },
  amountPaid: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  amountMissing: {
    color: Colors.onSurfaceVariant,
  },
});

export type { MonthStatus };

/**
 * TransactionRow — Composant Module 03 PAIEMENT
 * Affiche une ligne de transaction dans les listes SCR-008 et SCR-009.
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { StatusBadge } from '../common/StatusBadge';
import type { PaymentStatus } from '../common/StatusBadge';
import { OPERATORS } from '../../constants/operators';

type Operator = 'airtel' | 'orange' | 'mpesa' | 'mtn';

interface Props {
  memberName: string;
  memberAvatar: string | null;
  amount: number;
  currency: 'CDF' | 'USD';
  operator: Operator;
  date: string;           // ISO 8601
  status: PaymentStatus;
  txReference: string;
  onPress: () => void;
}

// ─── helpers ────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} à ${hh}:${min}`;
  } catch {
    return iso;
  }
}

function getAmountColor(status: PaymentStatus): string {
  switch (status) {
    case 'PAYE':    return Colors.secondary;
    case 'ECHEC':   return Colors.error;
    case 'EN_RETARD': return Colors.warning;
    default:        return Colors.onSurface;
  }
}

function getInitials(name: string): string {
  return (name ?? '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── composant ──────────────────────────────────────────────

export function TransactionRow({
  memberName,
  memberAvatar,
  amount,
  currency,
  operator,
  date,
  status,
  txReference,
  onPress,
}: Props) {
  const op = OPERATORS.find((o) => o.id === operator);
  const amountColor = getAmountColor(status);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* ── Avatar ── */}
      <View style={styles.avatarWrap}>
        {memberAvatar ? (
          <Image source={{ uri: memberAvatar }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarImg, styles.avatarFallback]}>
            <Text style={styles.initials}>{getInitials(memberName)}</Text>
          </View>
        )}
      </View>

      {/* ── Infos centre ── */}
      <View style={styles.centerBlock}>
        <Text style={styles.memberName} numberOfLines={1}>
          {memberName}
        </Text>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        <Text style={styles.txRef} numberOfLines={1}>
          {txReference}
        </Text>
      </View>

      {/* ── Droite : montant + opérateur + badge ── */}
      <View style={styles.rightBlock}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {amount.toLocaleString('fr-FR')}{' '}
          <Text style={styles.currency}>{currency}</Text>
        </Text>

        <View style={styles.opAndBadge}>
          {op?.logo && (
            <Image source={op.logo} style={styles.opLogo} resizeMode="contain" />
          )}
          <StatusBadge status={status} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── styles ─────────────────────────────────────────────────

const AVATAR_SIZE = 42;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
    gap: 12,
  },

  // Avatar
  avatarWrap: { flexShrink: 0 },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.full,
  },
  avatarFallback: {
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.primary,
  },

  // Centre
  centerBlock: { flex: 1, gap: 2 },
  memberName: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  txRef: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },

  // Droite
  rightBlock: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  amount: {
    fontFamily: Fonts.headline,
    fontSize: 14,
  },
  currency: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  opAndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opLogo: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Fonts } from '../../constants/colors';

export type PaymentStatus = 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC' | 'PARTIEL';

interface Props {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  PAYE:       { bg: Colors.secondaryContainer,   text: Colors.onSecondaryContainer, label: 'PAYÉ'        },
  EN_ATTENTE: { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant,     label: 'EN ATTENTE'  },
  EN_RETARD:  { bg: Colors.errorContainer,       text: Colors.onErrorContainer,     label: 'EN RETARD'   },
  ECHEC:      { bg: '#FFD6D6',                   text: Colors.error,                label: 'ÉCHEC'       },
  PARTIEL:    { bg: '#E3EDFF',                   text: Colors.tertiary,             label: 'PARTIEL'     },
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.EN_ATTENTE;
  const isMd = size === 'md';
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, paddingHorizontal: isMd ? 10 : 7, paddingVertical: isMd ? 4 : 2 }]}>
      <Text style={[styles.label, { color: cfg.text, fontSize: isMd ? 11 : 9.5 }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Fonts.label,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

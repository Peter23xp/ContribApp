import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Fonts } from '../../constants/colors';

export type PaymentStatus = 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC' | 'PARTIEL' | 'EN_VERIFICATION' | 'REJETEE';

interface Props {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

// Warm, rich status palette — each state has clear semantic temperature
const STATUS_CONFIG: Record<PaymentStatus, { bg: string; text: string; label: string; dot: string }> = {
  PAYE: {
    bg: '#E8F5E9',
    text: '#1B6D24',
    label: 'PAYÉ',
    dot: '#1B6D24',
  },
  EN_ATTENTE: {
    bg: '#FFF8EC',
    text: '#9B6400',
    label: 'EN ATTENTE',
    dot: '#E09900',
  },
  EN_RETARD: {
    bg: '#FEF0F0',
    text: '#BA1A1A',
    label: 'EN RETARD',
    dot: '#BA1A1A',
  },
  ECHEC: {
    bg: '#FEE8E8',
    text: '#93000A',
    label: 'ÉCHEC',
    dot: '#BA1A1A',
  },
  PARTIEL: {
    bg: '#EAF2FF',
    text: '#002D5E',
    label: 'PARTIEL',
    dot: '#0056C7',
  },
  EN_VERIFICATION: {
    bg: '#F8F0FE',
    text: '#6A1B9A',
    label: 'EN VÉRIF.',
    dot: '#9B59B6',
  },
  REJETEE: {
    bg: '#FEE8E8',
    text: '#93000A',
    label: 'REJETÉE',
    dot: '#BA1A1A',
  },
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.EN_ATTENTE;
  const isMd = size === 'md';
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bg,
          paddingHorizontal: isMd ? 10 : 7,
          paddingVertical: isMd ? 5 : 3,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: cfg.dot, width: isMd ? 6 : 5, height: isMd ? 6 : 5 }]} />
      <Text style={[styles.label, { color: cfg.text, fontSize: isMd ? 11 : 9.5 }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    borderRadius: Radius.full,
  },
  label: {
    fontFamily: Fonts.title,
    letterSpacing: 0.4,
  },
});

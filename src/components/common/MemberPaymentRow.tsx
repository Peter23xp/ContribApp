import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../../constants/colors';

type PaymentStatus = 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'PARTIEL';

interface Member {
  id: string;
  fullName: string;
  avatar?: string;
  paymentStatus: PaymentStatus;
  amount: number;
  phone: string;
}

interface Props {
  member: Member;
  onReminderPress?: (member: Member) => void;
  showReminder?: boolean;
  reminderSent?: boolean;
}

const STATUS_CONFIG: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  PAYE:       { bg: Colors.secondaryContainer,  text: Colors.secondary,        label: 'Payé'       },
  EN_ATTENTE: { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'En attente' },
  EN_RETARD:  { bg: Colors.errorContainer,       text: Colors.error,            label: 'En retard'  },
  PARTIEL:    { bg: Colors.tertiaryContainer,    text: Colors.tertiary,         label: 'Partiel'    },
};

function Avatar({ name }: { name: string }) {
  const initials = (name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function MemberPaymentRow({ member, onReminderPress, showReminder = false, reminderSent = false }: Props) {
  const cfg = STATUS_CONFIG[member.paymentStatus];
  return (
    <View style={styles.row}>
      <Avatar name={member.fullName} />
      <View style={styles.info}>
        <Text style={styles.name}>{member.fullName}</Text>
        <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.chipText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.amount}>
        {member.amount.toLocaleString()} <Text style={styles.currency}>CDF</Text>
      </Text>
      {showReminder && (
        <TouchableOpacity
          style={[styles.bellBtn, reminderSent && styles.bellBtnDone]}
          onPress={() => onReminderPress?.(member)}
          disabled={reminderSent}
        >
          <MaterialCommunityIcons
            name={reminderSent ? 'check' : 'bell-ring-outline'}
            size={18}
            color={reminderSent ? Colors.secondary : Colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, marginBottom: 4 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  chipText: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 14, fontWeight: '700', color: Colors.onSurface, marginRight: 8 },
  currency: { fontSize: 11, fontWeight: '400', color: Colors.onSurfaceVariant },
  bellBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  bellBtnDone: { backgroundColor: Colors.secondaryContainer },
});

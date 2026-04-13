import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

export interface InvitationData {
  id: string;
  phone: string;
  sentAt: string;
  status: 'pending' | 'expired';
}

interface Props {
  invitation: InvitationData;
  onCancelPress: (inv: InvitationData) => void;
}

export function InvitationRow({ invitation, onCancelPress }: Props) {
  const isPending = invitation.status === 'pending';
  
  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 8) return phone;
    const prefix = phone.substring(0, 6); // ex: +243 9
    const suffix = phone.substring(phone.length - 3); // ex: 123
    return `${prefix}X XXX ${suffix}`;
  };

  return (
    <View style={s.container}>
      <View style={s.infoColumn}>
        <View style={s.topRow}>
          <Text style={s.phone}>{maskPhone(invitation.phone)}</Text>
          <View style={[s.badge, isPending ? s.badgePending : s.badgeExpired]}>
            <Text style={[s.badgeText, isPending ? s.textPending : s.textExpired]}>
              {isPending ? 'En attente' : 'Expiré'}
            </Text>
          </View>
        </View>
        <Text style={s.date}>Envoyé le {formatDate(invitation.sentAt)}</Text>
      </View>
      
      {isPending && (
        <TouchableOpacity 
          style={s.cancelBtn} 
          onPress={() => onCancelPress(invitation)}
          activeOpacity={0.8}
        >
          <Text style={s.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
    gap: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phone: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgePending: {
    backgroundColor: '#FFF3E0', // Orange light
  },
  badgeExpired: {
    backgroundColor: '#EEEEEE', // Gris light
  },
  badgeText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
  },
  textPending: {
    color: '#EF6C00', // Orange text
  },
  textExpired: {
    color: '#757575', // Gris text
  },
  date: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: '#FFEBEE',
  },
  cancelBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: '#C62828',
  },
});

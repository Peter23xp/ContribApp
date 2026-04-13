import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { StatusBadge, type PaymentStatus } from './StatusBadge';

export type MemberRole = 'admin' | 'treasurer' | 'auditor' | 'member';
export type MemberStatus = 'active' | 'suspended' | 'removed';

export interface MemberCardData {
  id: string;
  fullName: string;
  avatar: string | null;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  paymentStatus: PaymentStatus | null;
  joinedAt: string;
}

interface Props {
  member: MemberCardData;
  onActionPress: (member: MemberCardData, action: 'remind' | 'edit_role' | 'suspend') => void;
  showSwipeActions: boolean;
}

const ROLE_COLORS: Record<MemberRole, { bg: string; text: string; label: string }> = {
  admin:     { bg: '#E1BEE7', text: '#6A1B9A', label: 'Admin' },      // Violet
  treasurer: { bg: '#BBDEFB', text: '#1565C0', label: 'Trésorière' }, // Bleu
  auditor:   { bg: '#E0E0E0', text: '#424242', label: 'Auditeur' },   // Gris
  member:    { bg: '#C8E6C9', text: '#2E7D32', label: 'Membre' },     // Vert clair
};

const STATUS_COLORS: Record<MemberStatus, { bg: string; text: string; label: string }> = {
  active:    { bg: '#E8F5E9', text: '#2E7D32', label: 'Actif' },      // Vert
  suspended: { bg: '#FFF3E0', text: '#EF6C00', label: 'Suspendu' },   // Orange
  removed:   { bg: '#FFEBEE', text: '#C62828', label: 'Retiré' },     // Rouge
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{initials}</Text>
    </View>
  );
}

export function MemberCard({ member, onActionPress, showSwipeActions }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  
  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const closeAndAction = (action: 'remind' | 'edit_role' | 'suspend') => {
    swipeRef.current?.close();
    onActionPress(member, action);
  };

  const renderLeftActions = (progress: any, dragX: any) => {
    if (!showSwipeActions) return null;
    return (
      <TouchableOpacity
        style={s.remindAction}
        onPress={() => closeAndAction('remind')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#FFF" />
        <Text style={s.actionText}>Rappel</Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (progress: any, dragX: any) => {
    if (!showSwipeActions) return null;
    return (
      <View style={s.rightActionsContainer}>
        <TouchableOpacity
          style={s.editRoleAction}
          onPress={() => closeAndAction('edit_role')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-edit-outline" size={24} color="#FFF" />
          <Text style={s.actionText}>Rôle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.suspendAction}
          onPress={() => closeAndAction('suspend')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-off-outline" size={24} color="#FFF" />
          <Text style={s.actionText}>Suspendre</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const roleTheme = ROLE_COLORS[member.role] || ROLE_COLORS.member;
  const statusTheme = STATUS_COLORS[member.status] || STATUS_COLORS.active;

  const content = (
    <View style={s.container}>
      <Avatar name={member.fullName} />
      <View style={s.infoColumn}>
        <View style={s.headerRow}>
          <Text style={s.name} numberOfLines={1}>{member.fullName}</Text>
          {member.paymentStatus && (
            <StatusBadge status={member.paymentStatus} />
          )}
        </View>
        
        <View style={s.badgesRow}>
          <View style={[s.badge, { backgroundColor: roleTheme.bg }]}>
            <Text style={[s.badgeText, { color: roleTheme.text }]}>{roleTheme.label}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusTheme.bg }]}>
            <Text style={[s.badgeText, { color: statusTheme.text }]}>{statusTheme.label}</Text>
          </View>
        </View>
        
        <Text style={s.joinedDate}>Membre depuis le {formatDate(member.joinedAt)}</Text>
      </View>
    </View>
  );

  if (showSwipeActions) {
    return (
      <Swipeable
        ref={swipeRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        friction={2}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Fonts.headline,
    color: Colors.primary,
    fontSize: 18,
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
  },
  joinedDate: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  // Swipe Actions
  remindAction: {
    width: 80,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActionsContainer: {
    flexDirection: 'row',
  },
  editRoleAction: {
    width: 80,
    backgroundColor: '#757575', // Gris
    justifyContent: 'center',
    alignItems: 'center',
  },
  suspendAction: {
    width: 80,
    backgroundColor: Colors.error, // Rouge
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: '#FFF',
    marginTop: 4,
    fontWeight: '600',
  },
});

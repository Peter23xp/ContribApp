/**
 * SwipeableMemberRow.tsx — Composant partagé Module 04
 *
 * Ligne de membre avec swipe gestures :
 *  → droite  : bouton bleu "Rappel"
 *  ← gauche  : bouton jaune "Rôle" + bouton rouge "Suspendre"
 *
 * Utilise react-native-gesture-handler (Swipeable natif RN).
 */
import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius } from '../../constants/colors';
import { StatusBadge, type PaymentStatus } from './StatusBadge';
import type { MemberRole } from '../../services/groupService';

// ─── Types ───────────────────────────────────────────────────

export interface MemberRowData {
  id:            string;
  fullName:      string;
  avatar:        string | null;
  role:          MemberRole;
  paymentStatus: PaymentStatus | null;
  phone:         string;
  joinDate:      string;   // ISO 8601
}

interface Props {
  member:       MemberRowData;
  onRemind:     (member: MemberRowData) => void;
  onEditRole:   (member: MemberRowData) => void;
  onSuspend:    (member: MemberRowData) => void;
}

// ─── Labels de rôle ──────────────────────────────────────────

const ROLE_LABELS: Record<MemberRole, string> = {
  admin:     'Admin',
  treasurer: 'Trésorière',
  member:    'Membre',
  auditor:   'Auditeur',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  admin:     Colors.primary,
  treasurer: Colors.tertiary,
  member:    Colors.onSurfaceVariant,
  auditor:   Colors.warning,
};

// ─── Avatar ──────────────────────────────────────────────────

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = (name ?? '?')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[
      s.avatar,
      { width: size, height: size, borderRadius: size / 2 },
    ]}>
      <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// ─── Composant principal ─────────────────────────────────────

export function SwipeableMemberRow({ member, onRemind, onEditRole, onSuspend }: Props) {
  const swipeRef = useRef<Swipeable>(null);

  const closeSwipe = useCallback(() => swipeRef.current?.close(), []);

  // ── Actions swipe DROITE (Rappel) ──
  const renderLeftActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>) => {
      const translateX = progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [-80, 0],
      });
      return (
        <Animated.View style={[s.leftAction, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={s.remindBtn}
            onPress={() => { closeSwipe(); onRemind(member); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#FFF" />
            <Text style={s.actionLabel}>Rappel</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [member, onRemind, closeSwipe],
  );

  // ── Actions swipe GAUCHE (Rôle + Suspendre) ──
  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>) => {
      const translateX = progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [160, 0],
      });
      return (
        <Animated.View style={[s.rightActions, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={s.roleBtn}
            onPress={() => { closeSwipe(); onEditRole(member); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shield-edit-outline" size={20} color="#FFF" />
            <Text style={s.actionLabel}>Rôle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.suspendBtn}
            onPress={() => { closeSwipe(); onSuspend(member); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="account-off-outline" size={20} color="#FFF" />
            <Text style={s.actionLabel}>Suspendre</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [member, onEditRole, onSuspend, closeSwipe],
  );

  const joinDateLabel = member.joinDate
    ? new Date(member.joinDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <View style={s.row}>
        {/* Avatar */}
        <Avatar name={member.fullName} />

        {/* Contenu principal */}
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{member.fullName}</Text>
            <View style={[s.roleBadge, { backgroundColor: ROLE_COLORS[member.role] + '18' }]}>
              <Text style={[s.roleBadgeText, { color: ROLE_COLORS[member.role] }]}>
                {ROLE_LABELS[member.role]}
              </Text>
            </View>
          </View>
          <Text style={s.joinDate}>Inscrit le {joinDateLabel}</Text>
        </View>

        {/* StatusBadge paiement */}
        {member.paymentStatus ? (
          <StatusBadge status={member.paymentStatus} />
        ) : (
          <View style={s.noBadge}>
            <Text style={s.noBadgeText}>—</Text>
          </View>
        )}
      </View>
      {/* Séparateur */}
      <View style={s.separator} />
    </Swipeable>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant + '50',
    marginLeft: 72,  // align with name, past the avatar
  },

  // Avatar
  avatar: {
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontFamily: Fonts.headline,
    color: Colors.primary,
  },

  // Info
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  roleBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
  },
  joinDate: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Statut
  noBadge: {
    paddingHorizontal: 8,
  },
  noBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Actions swipe DROITE (rappel bleu)
  leftAction: {
    justifyContent: 'center',
  },
  remindBtn: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.tertiary,
    gap: 4,
  },

  // Actions swipe GAUCHE (rôle jaune + suspendre rouge)
  rightActions: {
    flexDirection: 'row',
  },
  roleBtn: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    gap: 4,
  },
  suspendBtn: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.error,
    gap: 4,
  },
  actionLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
});

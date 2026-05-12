/**
 * NotificationItem.tsx — Composant partagé Module 06
 * 
 * Ligne de notification avec :
 *  - Icône type dans cercle coloré
 *  - Titre + corps + timestamp relatif
 *  - Point bleu si non lu
 *  - Swipe gauche pour supprimer
 *  - Tap pour marquer comme lu et naviguer
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text, TouchableOpacity,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Fonts } from '../../constants/colors';
import { relativeTime } from '../../utils/formatDate';

// ─── Types ───────────────────────────────────────────────────

export type NotificationType =
  | 'PAIEMENT_RECU'
  | 'PAIEMENT_CONFIRME'
  | 'RAPPEL_ECHEANCE'
  | 'RETARD'
  | 'NOUVEAU_MEMBRE'
  | 'RAPPORT_PRET'
  | 'SYSTEME';

export interface Notification {
  id:                 string;
  type:               NotificationType | string;
  title:              string;
  body:               string;
  isRead:             boolean;
  createdAt:          string;  // ISO 8601
  navigationTarget?:  string;  // nom de l'écran
  navigationParams?:  Record<string, any>;
}

interface Props {
  notification:     Notification;
  onPress:          (notification: Notification) => void;
  onSwipeDelete:    (notification: Notification) => void;
}

// ─── Configuration icônes par type ──────────────────────────

const DEFAULT_CONFIG = { icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap, color: Colors.onSurfaceVariant };

const NOTIFICATION_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  // Uppercase legacy keys
  PAIEMENT_RECU:      { icon: 'cash-outline',           color: Colors.statusPaid },
  PAIEMENT_CONFIRME:  { icon: 'checkmark-circle',       color: Colors.statusPaid },
  RAPPEL_ECHEANCE:    { icon: 'notifications-outline',  color: Colors.warning },
  RETARD:             { icon: 'alert-circle-outline',   color: Colors.warning },
  NOUVEAU_MEMBRE:     { icon: 'person-add-outline',     color: Colors.tertiary },
  RAPPORT_PRET:       { icon: 'document-text-outline',  color: '#6A1B9A' },
  SYSTEME:            { icon: 'information-circle',     color: Colors.onSurfaceVariant },
  // Lowercase Firestore keys
  payment_confirmed:  { icon: 'checkmark-circle',       color: Colors.statusPaid },
  payment_rejected:   { icon: 'close-circle-outline',   color: Colors.error },
  new_submission:     { icon: 'cash-outline',           color: Colors.statusPaid },
  reminder:           { icon: 'notifications-outline',  color: Colors.warning },
  late_payment:       { icon: 'alert-circle-outline',   color: Colors.warning },
  new_member:         { icon: 'person-add-outline',     color: Colors.tertiary },
  report_ready:       { icon: 'document-text-outline',  color: '#6A1B9A' },
  info_requested:     { icon: 'information-circle',     color: Colors.onSurfaceVariant },
  join_request:       { icon: 'person-add-outline',     color: Colors.tertiary },
  system:             { icon: 'information-circle',     color: Colors.onSurfaceVariant },
};

// ─── Timestamp relatif ───────────────────────────────────────

// Replaced by relativeTime() from formatDate.ts

// ─── Composant principal ─────────────────────────────────────

export function NotificationItem({ notification, onPress, onSwipeDelete }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const config = NOTIFICATION_CONFIG[notification.type] ?? DEFAULT_CONFIG;

  const closeSwipe = useCallback(() => swipeRef.current?.close(), []);

  const handlePress = useCallback(() => {
    onPress(notification);
  }, [notification, onPress]);

  const handleDelete = useCallback(() => {
    closeSwipe();
    onSwipeDelete(notification);
  }, [notification, onSwipeDelete, closeSwipe]);

  // ── Action swipe GAUCHE (Supprimer) ──
  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>) => {
      const translateX = progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [80, 0],
      });
      return (
        <Animated.View style={[s.rightAction, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
            <Text style={s.actionLabel}>Supprimer</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [handleDelete],
  );

  const relativeTimeLabel = relativeTime(notification.createdAt);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={[
          s.row,
          !notification.isRead && s.rowUnread,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Icône type dans cercle coloré */}
        <View style={[s.iconCircle, { backgroundColor: config.color + '18' }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>

        {/* Contenu principal */}
        <View style={s.content}>
          <Text
            style={[s.title, !notification.isRead && s.titleUnread]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={s.body} numberOfLines={2}>
            {notification.body}
          </Text>
          <Text style={s.timestamp}>{relativeTimeLabel}</Text>
        </View>

        {/* Point bleu si non lu */}
        {!notification.isRead && <View style={s.unreadDot} />}
      </TouchableOpacity>
      {/* Séparateur */}
      <View style={s.separator} />
    </Swipeable>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowUnread: {
    backgroundColor: '#EBF5FB',  // bleu très clair
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurface,
  },
  titleUnread: {
    fontFamily: Fonts.headline,
    fontWeight: '700',
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  timestamp: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant + '50',
    marginLeft: 68,  // align with content, past the icon
  },

  // Action swipe GAUCHE (supprimer rouge)
  rightAction: {
    justifyContent: 'center',
  },
  deleteBtn: {
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

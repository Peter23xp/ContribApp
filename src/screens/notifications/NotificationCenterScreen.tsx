/**
 * NotificationCenterScreen.tsx — SCR-022 Module 06
 * 
 * Centre de notifications avec :
 *  - Liste des notifications
 *  - Filtres (Toutes, Non lues, Paiements, Rappels, Système)
 *  - Actions (marquer lu, supprimer)
 *  - Polling toutes les 60s
 *  - Navigation vers écrans cibles
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { LoadingOverlay, NotificationItem } from '../../components/common';
import type { Notification } from '../../components/common/NotificationItem';
import { Colors, Fonts, Radius } from '../../constants/colors';
import * as notificationService from '../../services/notificationService';
import { useNotificationStore } from '../../stores/notificationStore';

// ─── Types ────────────────────────────────────────────────────

type FilterType = 'all' | 'unread' | 'payments' | 'reminders' | 'system';

interface GroupedNotifications {
  title: string;
  data: Notification[];
}

// ─── Composant principal ──────────────────────────────────────

export default function NotificationCenterScreen({ navigation }: any) {
  const { notifications, unreadCount, setNotifications, setUnreadCount, markAsRead, markAllAsRead, removeNotification, removeReadNotifications } = useNotificationStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Chargement initial ──
  const loadNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (!append) setIsLoading(true);

      const response = await notificationService.getNotifications('ALL', { pageSize: 30 });
      const items: any[] = response;
      
      if (append) {
        setNotifications([...notifications, ...items]);
      } else {
        setNotifications(items);
      }
      
      setUnreadCount(items.filter((n: any) => !n.isRead).length);
      setHasMore(items.length === 30);
      setPage(pageNum);
    } catch (error) {
      console.error('[NotificationCenterScreen] loadNotifications error:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger les notifications',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [notifications, setNotifications, setUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, []);

  // ── Polling (toutes les 60s) ──
  const startPolling = useCallback(() => {
    if (pollingInterval.current) return;

    pollingInterval.current = setInterval(async () => {
      try {
        const response: any[] = await notificationService.getNotifications('ALL', { pageSize: 10 });
        
        // Comparer avec la liste locale et ajouter les nouvelles
        const existingIds = new Set(notifications.map((n: any) => n.id));
        const newNotifications = response.filter((n: any) => !existingIds.has(n.id));
        
        if (newNotifications.length > 0) {
          setNotifications([...newNotifications, ...notifications]);
          const newUnread = newNotifications.filter((n: any) => !n.isRead).length;
          setUnreadCount(unreadCount + newUnread);
        }
      } catch (error) {
        console.error('[NotificationCenterScreen] polling error:', error);
      }
    }, 60000); // 60 secondes
  }, [notifications, setNotifications, setUnreadCount]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // ── Gestion du focus (démarrer/arrêter polling) ──
  useFocusEffect(
    useCallback(() => {
      startPolling();
      
      return () => {
        stopPolling();
        // Marquer toutes comme lues à la fermeture
        handleMarkAllRead(true);
      };
    }, [startPolling, stopPolling])
  );

  // ── Filtrage local ──
  const filteredNotifications = useCallback(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter(n => !n.isRead);
      case 'payments':
        return notifications.filter(n => n.type.includes('PAIEMENT'));
      case 'reminders':
        return notifications.filter(n => n.type.includes('RAPPEL') || n.type.includes('RETARD'));
      case 'system':
        return notifications.filter(n => 
          n.type === 'SYSTEME' || n.type === 'NOUVEAU_MEMBRE' || n.type === 'RAPPORT_PRET'
        );
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // ── Groupement par date ──
  const groupedNotifications = useCallback((): GroupedNotifications[] => {
    const filtered = filteredNotifications();
    const groups: Record<string, Notification[]> = {};

    filtered.forEach(notification => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupTitle: string;
      if (date.toDateString() === today.toDateString()) {
        groupTitle = 'Aujourd\'hui';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupTitle = 'Hier';
      } else {
        groupTitle = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      }

      if (!groups[groupTitle]) {
        groups[groupTitle] = [];
      }
      groups[groupTitle].push(notification);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  // ── Actions ──
  const handleNotificationPress = async (notification: Notification) => {
    // Marquer comme lue
    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(notification.id);
        markAsRead(notification.id);
        await notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
      } catch (error) {
        console.error('[NotificationCenterScreen] markAsRead error:', error);
      }
    }

    // Naviguer vers l'écran cible
    const target = notificationService.getNavigationTarget(notification);
    if (target) {
      navigation.navigate(target.screen, target.params);
    }
  };

  const handleNotificationDelete = async (notification: Notification) => {
    // Optimistic update
    const wasUnread = !notification.isRead;
    removeNotification(notification.id);

    try {
      await notificationService.deleteNotification(notification.id);
      if (wasUnread) {
        await notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('[NotificationCenterScreen] deleteNotification error:', error);
      // Remettre la notification (pas implémenté pour simplifier)
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de supprimer la notification',
      });
      loadNotifications();
    }
  };

  const handleMarkAllRead = async (silent = false) => {
    if (unreadCount === 0) return;

    try {
      if (!silent) setIsMarkingAllRead(true);
      await notificationService.markAllAsRead('ALL');
      markAllAsRead();
      await notificationService.setBadgeCount(0);
      
      if (!silent) {
        Toast.show({
          type: 'success',
          text1: 'Notifications lues',
          text2: 'Toutes les notifications ont été marquées comme lues',
        });
      }
    } catch (error) {
      console.error('[NotificationCenterScreen] markAllAsRead error:', error);
      if (!silent) {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Impossible de marquer toutes comme lues',
        });
      }
    } finally {
      if (!silent) setIsMarkingAllRead(false);
    }
  };

  const handleDeleteReadNotifications = () => {
    const readCount = notifications.filter(n => n.isRead).length;
    if (readCount === 0) return;

    Alert.alert(
      'Supprimer les notifications lues ?',
      `${readCount} notification${readCount > 1 ? 's' : ''} sera${readCount > 1 ? 'ont' : ''} supprimée${readCount > 1 ? 's' : ''}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.deleteReadNotifications('ALL');
              removeReadNotifications();
              Toast.show({
                type: 'success',
                text1: 'Notifications supprimées',
                text2: 'Les notifications lues ont été supprimées',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Erreur',
                text2: 'Impossible de supprimer les notifications',
              });
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadNotifications(1, false);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadNotifications(page + 1, true);
    }
  };

  // ── Render ──
  const renderFilter = (filter: FilterType, label: string) => {
    const isActive = activeFilter === filter;
    const count = filter === 'unread' ? unreadCount : 0;
    const displayLabel = count > 0 && filter === 'unread' ? `${label} (${count})` : label;

    return (
      <TouchableOpacity
        key={filter}
        style={[s.filterChip, isActive && s.filterChipActive]}
        onPress={() => setActiveFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
          {displayLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: GroupedNotifications }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onSwipeDelete={handleNotificationDelete}
    />
  );

  const renderEmpty = () => {
    const filtered = filteredNotifications();
    const isEmpty = filtered.length === 0;

    if (!isEmpty) return null;

    return (
      <View style={s.emptyContainer}>
        <Ionicons
          name={activeFilter === 'all' ? 'notifications-outline' : 'filter-outline'}
          size={64}
          color={Colors.outlineVariant}
        />
        <Text style={s.emptyTitle}>
          {activeFilter === 'all' 
            ? 'Aucune notification'
            : 'Aucune notification pour ce filtre'}
        </Text>
        <Text style={s.emptySubtitle}>
          {activeFilter === 'all'
            ? 'Vous n\'avez pas encore de notifications.'
            : 'Essayez un autre filtre.'}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    const readCount = notifications.filter(n => n.isRead).length;
    if (readCount === 0 || filteredNotifications().length === 0) return null;

    return (
      <TouchableOpacity
        style={s.deleteReadButton}
        onPress={handleDeleteReadNotifications}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
        <Text style={s.deleteReadButtonText}>
          Effacer les notifications lues ({readCount})
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading && notifications.length === 0) {
    return <LoadingOverlay message="Chargement des notifications..." />;
  }

  const grouped = groupedNotifications();

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <SafeAreaView edges={['top']} style={s.header}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={s.markAllButton}
            onPress={() => handleMarkAllRead(false)}
            activeOpacity={0.7}
          >
            <Text style={s.markAllButtonText}>Tout lire</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 80 }} />}
      </SafeAreaView>

      {/* Filtres */}
      <View style={s.filtersContainer}>
        <FlatList
          horizontal
          data={[
            { filter: 'all' as FilterType, label: 'Toutes' },
            { filter: 'unread' as FilterType, label: 'Non lues' },
            { filter: 'payments' as FilterType, label: 'Paiements' },
            { filter: 'reminders' as FilterType, label: 'Rappels' },
            { filter: 'system' as FilterType, label: 'Système' },
          ]}
          renderItem={({ item }) => renderFilter(item.filter, item.label)}
          keyExtractor={(item) => item.filter}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersContent}
        />
      </View>

      {/* Liste */}
      <FlatList
        data={grouped.flatMap(group => [
          { type: 'header', title: group.title },
          ...group.data.map(n => ({ type: 'notification', data: n })),
        ])}
        renderItem={({ item }: any) => {
          if (item.type === 'header') {
            return renderSectionHeader({ section: { title: item.title, data: [] } });
          }
          return renderNotification({ item: item.data });
        }}
        keyExtractor={(item: any, index) => 
          item.type === 'header' ? `header-${item.title}` : item.data.id
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={s.listContent}
      />

      {/* Loading overlay */}
      {isMarkingAllRead && <LoadingOverlay message="" />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markAllButtonText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.secondary,
  },

  // Filtres
  filtersContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: '#FFF',
  },

  // Liste
  listContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceContainerLow,
  },
  sectionHeaderText: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
  },

  // Footer
  deleteReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginVertical: 20,
    marginHorizontal: 20,
    borderRadius: Radius.lg,
    backgroundColor: Colors.errorContainer + '30',
  },
  deleteReadButtonText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.error,
  },
});

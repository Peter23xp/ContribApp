/**
 * notificationStore.ts — Store Zustand pour les notifications
 * 
 * Gère :
 *  - Liste des notifications
 *  - Compteur de non lues (badge)
 *  - Actions CRUD
 */

import { create } from 'zustand';
import type { Notification } from '../components/common/NotificationItem';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  removeReadNotifications: () => void;
  setUnreadCount: (count: number) => void;
  decrementUnreadCount: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
  })),

  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    if (!notification || notification.isRead) return state;

    return {
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    };
  }),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0,
  })),

  removeNotification: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    const wasUnread = notification && !notification.isRead;

    return {
      notifications: state.notifications.filter(n => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    };
  }),

  removeReadNotifications: () => set((state) => ({
    notifications: state.notifications.filter(n => !n.isRead),
  })),

  setUnreadCount: (count) => set({ unreadCount: count }),

  decrementUnreadCount: () => set((state) => ({
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

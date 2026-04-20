/**
 * notificationService.ts — v2.0
 * FCM + Firestore uniquement — AUCUNE référence à SQLite, SecureStore, USE_LOCAL_DB
 */
import {
  addDoc, doc, getDocs, updateDoc, deleteDoc, query, collection,
  where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'payment_confirmed' | 'payment_rejected' | 'new_submission'
  | 'reminder' | 'late_payment' | 'new_member' | 'report_ready'
  | 'info_requested' | 'join_request' | 'system';

export interface NotificationData {
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: { contribution_id?: string; group_id?: string; month?: string; [key: string]: any };
}

// ─── registerForPushNotifications ─────────────────────────────────────────────

export async function registerForPushNotifications(uid: string): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    await updateDoc(doc(db, 'users', uid), {
      fcm_token: token,
      updated_at: serverTimestamp(),
    });
    return token;
  } catch (e) {
    console.warn('[notificationService] Push registration échoué:', e);
    return null;
  }
}

// ─── getNotifications ─────────────────────────────────────────────────────────

export async function getNotifications(
  recipientUid: string,
  filters?: { is_read?: boolean; type?: NotificationType; pageSize?: number }
): Promise<any[]> {
  const constraints: any[] = [
    where('recipient_uid', '==', recipientUid),
    orderBy('created_at', 'desc'),
    limit(filters?.pageSize ?? 30),
  ];
  if (filters?.type) constraints.push(where('type', '==', filters.type));
  if (filters?.is_read !== undefined) constraints.push(where('is_read', '==', filters.is_read));

  const snap = await getDocs(query(collection(db, 'notifications'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── subscribeToNotifications ─────────────────────────────────────────────────

export function subscribeToNotifications(
  recipientUid: string,
  callback: (unreadCount: number, notifications: any[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'notifications'),
      where('recipient_uid', '==', recipientUid),
      where('is_read', '==', false),
      orderBy('created_at', 'desc')),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items.length, items);
    }
  );
}

// ─── markAsRead ───────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { is_read: true });
}

// ─── markAllAsRead ────────────────────────────────────────────────────────────

export async function markAllAsRead(recipientUid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'notifications'),
      where('recipient_uid', '==', recipientUid),
      where('is_read', '==', false))
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { is_read: true }));
  await batch.commit();
}

// ─── deleteNotification ───────────────────────────────────────────────────────

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

// ─── deleteAllRead ────────────────────────────────────────────────────────────

export async function deleteAllRead(recipientUid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'notifications'),
      where('recipient_uid', '==', recipientUid),
      where('is_read', '==', true))
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ─── createNotification ───────────────────────────────────────────────────────

export async function createNotification(data: NotificationData): Promise<string> {
  const ref = await addDoc(collection(db, 'notifications'), {
    recipient_uid: data.recipientUid,
    type: data.type,
    title: data.title,
    body: data.body,
    data: data.data ?? {},
    is_read: false,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

// ─── getUnreadCount ───────────────────────────────────────────────────────────

export async function getUnreadCount(recipientUid: string): Promise<number> {
  try {
    const q = query(collection(db, 'notifications'),
      where('recipient_uid', '==', recipientUid),
      where('is_read', '==', false));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    // Fallback si getCountFromServer non disponible
    const snap = await getDocs(
      query(collection(db, 'notifications'),
        where('recipient_uid', '==', recipientUid),
        where('is_read', '==', false))
    );
    return snap.size;
  }
}
// ─── Stubs for NotificationCenterScreen ─────────────────────────────────────

export async function setBadgeCount(count: number): Promise<void> {
  // stub: expo-notifications badge
  try {
    const Notifications = await import('expo-notifications');
    await (Notifications as any).setBadgeCountAsync?.(count);
  } catch { /* ignore */ }
}

export function getNavigationTarget(notification: any): { screen: string; params?: any } | null {
  if (!notification?.data) return null;
  const d = notification.data;
  if (d.contribution_id) return { screen: 'ReviewCapture', params: { contributionId: d.contribution_id } };
  if (d.group_id)        return { screen: 'GroupDetails',  params: { groupId: d.group_id } };
  return null;
}

/** Alias for deleteAllRead — recipientUid optional */
export async function deleteReadNotifications(recipientUid = 'ALL'): Promise<void> {
  if (recipientUid === 'ALL') return;
  return deleteAllRead(recipientUid);
}

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  collection, doc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

import { Platform } from 'react-native';

export interface Notification {
  id: string;
  recipient_uid: string;
  type: 'payment_received' | 'payment_confirmed' | 'reminder' | 'late_payment' | 'new_member' | 'report_ready' | 'system';
  title: string;
  body: string;
  data?: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

export interface CreateNotificationData {
  recipient_uid: string;
  type: Notification['type'];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return null;
  }
  
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, // Use real ID if needed for Expo token
  });
  const token = tokenData.data;

  // Store FCM token
  const uid = auth.currentUser?.uid;
  if (uid) {
    await updateDoc(doc(db, 'users', uid), {
      fcm_token: token
    });
  }

  return token;
}

export async function getNotifications(filters: any = {}): Promise<Notification[]> {
  const uid = auth.currentUser?.uid || 'user_dev';

  const q = query(
    collection(db, 'notifications'),
    where('recipient_uid', '==', uid),
    orderBy('created_at', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
}

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), {
    is_read: true
  });
}

export async function markAllAsRead(recipientUid: string): Promise<void> {
  const q = query(collection(db, 'notifications'), where('recipient_uid', '==', recipientUid), where('is_read', '==', false));
  const snap = await getDocs(q);
  
  const batch = writeBatch(db);
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { is_read: true });
  });
  
  if (snap.docs.length > 0) {
    await batch.commit();
  }
}

export async function createNotification(data: CreateNotificationData): Promise<void> {
  const id = 'notif_' + Date.now() + Math.random().toString(36).substr(2, 6);
  
  await setDoc(doc(db, 'notifications', id), {
    ...data,
    is_read: false,
    created_at: serverTimestamp()
  });
}

export async function getUnreadCount(recipientUid: string): Promise<number> {
  const q = query(collection(db, 'notifications'), where('recipient_uid', '==', recipientUid), where('is_read', '==', false));
  const snap = await getDocs(q);
  return snap.size;
}

export function subscribeToNotifications(callback: (count: number) => void): () => void {
  const uid = auth.currentUser?.uid || 'user_dev';
  
  const q = query(collection(db, 'notifications'), where('recipient_uid', '==', uid), where('is_read', '==', false));
  const unsubscribe = onSnapshot(q, (snap) => {
    callback(snap.size);
  });
  return unsubscribe;
}

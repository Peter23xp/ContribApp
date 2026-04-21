/**
 * database.ts — Service de données Firestore-only
 * 
 * Remplace l'ancien module SQLite. Toutes les fonctions sont async
 * et utilisent Firestore comme backend unique.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit as firestoreLimit, deleteDoc,
  Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** No-op — Firestore n'a pas besoin d'initialisation de schéma */
export const initDatabase = async (): Promise<void> => {
  console.log('[DB] ✅ Firestore prêt (pas d\'initialisation nécessaire)');
};

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

export const findUserByPhone = async (phone: string): Promise<any | null> => {
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const findUserById = async (id: string): Promise<any | null> => {
  const docSnap = await getDoc(doc(db, 'users', id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};

export const createUser = async (user: {
  id: string; full_name: string; phone: string;
  operator: string; pin_hash: string; profile_photo_url?: string;
}): Promise<void> => {
  await setDoc(doc(db, 'users', user.id), {
    full_name: user.full_name,
    phone: user.phone,
    operator: user.operator,
    pin_hash: user.pin_hash,
    profile_photo_url: user.profile_photo_url ?? null,
    role: 'member',
    is_verified: false,
    created_at: serverTimestamp(),
  });
};

export const markUserAsVerified = async (phone: string): Promise<void> => {
  const user = await findUserByPhone(phone);
  if (user) {
    await updateDoc(doc(db, 'users', user.id), { is_verified: true });
  }
};

// ─── Groupes ──────────────────────────────────────────────────────────────────

export const getGroupForAdmin = async (adminId: string): Promise<any | null> => {
  const q = query(collection(db, 'groups'), where('admin_uid', '==', adminId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const getGroupForMember = async (userId: string): Promise<any | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const userData = userDoc.data();
  const groupId = userData?.active_group_id;
  if (!groupId) return null;
  
  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  if (!groupDoc.exists()) return null;
  return { id: groupDoc.id, ...groupDoc.data() };
};

export const getMembersOfGroup = async (groupId: string): Promise<any[]> => {
  let membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const legacyMembers =
    membersSnap.empty
      ? await getDocs(
          query(
            collection(db, 'group_members'),
            where('group_id', '==', groupId)
          )
        )
      : null;

  const sourceDocs = membersSnap.empty && legacyMembers ? legacyMembers.docs : membersSnap.docs;
  const members: any[] = [];
  for (const memberDoc of sourceDocs) {
    const data = memberDoc.data();
    // Use user_id if present, else uid
    const userId = data.user_id || data.uid;
    if (!userId) continue;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      members.push({ id: userId, ...userDoc.data(), member_role: data.role });
    }
  }
  return members;
};

export const getGroupById = async (groupId: string): Promise<any | null> => {
  const docSnap = await getDoc(doc(db, 'groups', groupId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};

export const getAllGroups = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'groups'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getGroupByInviteCode = async (code: string): Promise<any | null> => {
  const q = query(collection(db, 'groups'), where('invite_code', '==', code.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const isAlreadyMember = async (userId: string, groupId: string): Promise<boolean> => {
  const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', userId));
  return memberDoc.exists();
};

export const joinGroup = async (userId: string, groupId: string): Promise<void> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  const userData = userDoc.exists() ? userDoc.data() : {};

  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    uid: userId,
    role: 'member',
    status: 'active',
    full_name: userData?.full_name ?? '',
    phone: userData?.phone ?? '',
    operator: userData?.operator ?? '',
    joined_at: serverTimestamp(),
  });

  await updateDoc(doc(db, 'users', userId), {
    active_group_id: groupId,
    updated_at: serverTimestamp(),
  });

  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  const groupData = groupDoc.data();
  if (groupDoc.exists()) {
    await updateDoc(doc(db, 'groups', groupId), {
      member_count: (groupData?.member_count ?? 0) + 1,
      updated_at: serverTimestamp(),
    });
  }

  // Créer une contribution EN_ATTENTE pour le mois en cours
  const month = getCurrentMonthKey();
  const existingQ = query(
    collection(db, 'contributions'),
    where('user_id', '==', userId),
    where('group_id', '==', groupId),
    where('month', '==', month)
  );
  const existingSnap = await getDocs(existingQ);
  
  if (existingSnap.empty) {
    await addDoc(collection(db, 'contributions'), {
      group_id: groupId,
      user_id: userId,
      month,
      amount: groupData?.contribution_amount ?? groupData?.monthly_amount ?? 0,
      penalty_amount: 0,
      status: 'EN_ATTENTE',
      created_at: serverTimestamp(),
    });
  }
  console.log(`[DB] ✅ ${userId} a rejoint le groupe ${groupId}`);
};

// ─── Contributions ────────────────────────────────────────────────────────────

export const getContributionsForMonth = async (groupId: string, month?: string): Promise<any[]> => {
  const m = month ?? getCurrentMonthKey();
  const [periodSnap, legacySnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('period_month', '==', m)
      )
    ),
    getDocs(
      query(
        collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('month', '==', m)
      )
    ),
  ]);

  const docsById = new Map<string, any>();
  for (const docSnap of [...periodSnap.docs, ...legacySnap.docs]) {
    docsById.set(docSnap.id, docSnap);
  }

  const results: any[] = [];
  for (const d of docsById.values()) {
    const data = d.data();
    const memberUid = data.member_uid ?? data.user_id;
    if (!memberUid) continue;

    const userDoc = await getDoc(doc(db, 'users', memberUid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    results.push({
      id: d.id,
      ...data,
      user_id: memberUid,
      member_uid: memberUid,
      month: data.period_month ?? data.month ?? m,
      amount: data.amount_paid || data.amount_due || data.amount || 0,
      status: data.status === 'paid' ? 'PAYE' : data.status === 'approved' ? 'PAYE' : data.status,
      full_name: userData?.full_name,
      phone: userData?.phone,
      user_operator: userData?.operator,
    });
  }
  return results;
};

export const getMemberContribution = async (userId: string, groupId: string, month?: string): Promise<any | null> => {
  const m = month ?? getCurrentMonthKey();
  const contributions = await getContributionsForMonth(groupId, m);
  const match = contributions.find((d) => {
    return (d.member_uid ?? d.user_id) === userId;
  });
  if (!match) return null;

  return {
    ...match,
    user_id: match.member_uid ?? match.user_id ?? userId,
    member_uid: match.member_uid ?? match.user_id ?? userId,
    month: match.period_month ?? match.month ?? m,
    // Utiliser || pour que 0 tombe aussi sur le fallback suivant
    amount: match.amount_paid || match.amount_due || match.amount || 0,
    paid_at: match.approved_at ?? match.paid_at ?? null,
    status:
      match.status === 'paid'
        ? 'PAYE'
        : match.status === 'pending_approval'
          ? 'EN_VERIFICATION'
          : match.status,
  };

};

export const getRecentPaymentsForMember = async (userId: string, limitCount = 3): Promise<any[]> => {
  // Try member_uid field first (new schema), then user_id (legacy schema)
  const [snapNew, snapLegacy] = await Promise.all([
    getDocs(
      query(
        collection(db, 'contributions'),
        where('member_uid', '==', userId),
        where('status', 'in', ['paid', 'PAYE', 'approved']),
        orderBy('approved_at', 'desc'),
        firestoreLimit(limitCount)
      )
    ).catch(() => ({ docs: [] as any[] })),
    getDocs(
      query(
        collection(db, 'contributions'),
        where('user_id', '==', userId),
        where('status', 'in', ['paid', 'PAYE', 'approved']),
        orderBy('paid_at', 'desc'),
        firestoreLimit(limitCount)
      )
    ).catch(() => ({ docs: [] as any[] })),
  ]);

  const docsById = new Map<string, any>();
  for (const d of [...snapNew.docs, ...snapLegacy.docs]) {
    docsById.set(d.id, d);
  }

  return Array.from(docsById.values())
    .slice(0, limitCount)
    .map((d) => ({
      id: d.id,
      ...d.data(),
      user_id: d.data().member_uid ?? d.data().user_id ?? userId,
      amount: d.data().amount_paid ?? d.data().amount_due ?? d.data().amount ?? 0,
      paid_at: d.data().approved_at ?? d.data().paid_at ?? null,
    }));
};


export const getRecentPaymentsForGroup = async (groupId: string, limitCount = 5): Promise<any[]> => {
  const q = query(
    collection(db, 'contributions'),
    where('group_id', '==', groupId),
    where('status', '==', 'PAYE'),
    orderBy('paid_at', 'desc'),
    firestoreLimit(limitCount)
  );
  const snap = await getDocs(q);
  const results: any[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const userDoc = await getDoc(doc(db, 'users', data.user_id));
    results.push({
      id: d.id,
      ...data,
      full_name: userDoc.exists() ? userDoc.data()?.full_name : '?',
    });
  }
  return results;
};

// ─── User Profile & Preferences ───────────────────────────────────────────────

export const getCurrentUser = async (): Promise<any | null> => {
  const { auth } = require('../config/firebase');
  if (!auth.currentUser) return null;
  return await findUserById(auth.currentUser.uid);
};

export const updateUser = async (userId: string, updates: Partial<{
  full_name: string;
  phone: string;
  operator: string;
  profile_photo_url: string | null;
  pin_hash: string;
  biometric_enabled: boolean;
  last_login: string;
}>): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), updates as any);
};

export const getUserPreferences = async (userId: string): Promise<any | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  return userDoc.data()?.preferences ?? null;
};

export const updateUserPreferences = async (userId: string, prefs: {
  pushEnabled?: boolean;
  smsReminders?: boolean;
  smsConfirmation?: boolean;
  monthlyReport?: boolean;
  language?: 'fr' | 'en';
  currency?: 'CDF' | 'USD';
}): Promise<void> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  const current = userDoc.exists() ? (userDoc.data()?.preferences ?? {}) : {};
  await updateDoc(doc(db, 'users', userId), {
    preferences: { ...current, ...prefs },
  });
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = async (page = 1, limitCount = 30): Promise<any[]> => {
  const q = query(
    collection(db, 'notifications'),
    orderBy('created_at', 'desc'),
    firestoreLimit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      title: data.title,
      body: data.body,
      isRead: Boolean(data.is_read),
      createdAt: data.created_at,
      navigationTarget: data.navigation_target,
      navigationParams: data.navigation_params,
    };
  });
};

export const getUnreadNotificationsCount = async (): Promise<number> => {
  const q = query(collection(db, 'notifications'), where('is_read', '==', false));
  const snap = await getDocs(q);
  return snap.size;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', id), { is_read: true });
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const q = query(collection(db, 'notifications'), where('is_read', '==', false));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => updateDoc(d.ref, { is_read: true }));
  await Promise.all(promises);
};

export const deleteNotification = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'notifications', id));
};

export const deleteReadNotifications = async (): Promise<void> => {
  const q = query(collection(db, 'notifications'), where('is_read', '==', true));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(promises);
};

export const createNotification = async (notification: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  navigationTarget?: string;
  navigationParams?: Record<string, any>;
}): Promise<void> => {
  await setDoc(doc(db, 'notifications', notification.id), {
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    is_read: false,
    created_at: serverTimestamp(),
    navigation_target: notification.navigationTarget ?? null,
    navigation_params: notification.navigationParams ?? null,
  });
};

// ─── OTP (géré par Firebase Auth en production) ───────────────────────────────
// Ces fonctions ne sont plus utilisées en mode Firebase-only.
// Firebase Auth gère l'OTP via signInWithPhoneNumber.
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
export const saveOTP = (_phone: string, _code: string, _context: string): void => {};
export const verifyOTPCode = (_phone: string, _code: string): { valid: boolean; reason?: string } => {
  return { valid: true };
};

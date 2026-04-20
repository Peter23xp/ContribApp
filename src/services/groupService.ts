/**
 * groupService.ts — v2.0
 * 100% Firestore — AUCUNE référence à SQLite, SecureStore, USE_LOCAL_DB
 */
import {
  doc, setDoc, getDoc, getDocs, updateDoc, addDoc, deleteDoc,
  query, collection, where, serverTimestamp, Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InviteCode {
  code: string;
  link: string;
  expiresAt?: string | null;
}

export interface PendingInvitation {
  id: string;
  phone: string;
  sentAt?: any;
  status?: string;
}

export interface GroupMember {
  uid: string;
  full_name?: string;
  phone?: string;
  operator?: string;
  role: string;
  status: string;
  paymentStatus?: string;
}

export interface GroupData {
  name: string;
  description?: string;
  photoUrl?: string;
  adminUid: string;
  treasurerUid: string;
  treasurerName: string;
  treasurerPhone: string;
  treasurerOperator: 'airtel' | 'orange' | 'mpesa' | 'mtn';
  contributionAmount: number;
  currency: 'CDF' | 'USD';
  paymentDeadlineDay: number;
  latePenaltyPercent: number;
  requireApproval: boolean;
  contributionsVisible: boolean;
}

export type MemberRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface GroupConfig {
  name: string;
  description?: string;
  photoUrl?: string | null;
  monthlyAmount: number;
  currency: 'CDF' | 'USD';
  dueDay: number;
  penaltyEnabled?: boolean;
  penaltyType?: 'fixed' | 'percentage';
  penaltyAmount: number;
  treasurerName: string;
  treasurerPhone: string;
  treasurerOperator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
  requireApproval: boolean;
  paymentsVisible: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GRP-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── createGroup ──────────────────────────────────────────────────────────────

export async function createGroup(data: GroupData, adminUid: string): Promise<string> {
  const inviteCode = generateInviteCode();
  const groupRef = doc(collection(db, 'groups'));
  const groupId = groupRef.id;

  await setDoc(groupRef, {
    name: data.name,
    description: data.description ?? '',
    photo_url: data.photoUrl ?? null,
    admin_uid: adminUid,
    treasurer_uid: data.treasurerUid,
    treasurer_name: data.treasurerName,
    treasurer_phone: data.treasurerPhone,
    treasurer_operator: data.treasurerOperator,
    contribution_amount: data.contributionAmount,
    currency: data.currency,
    payment_deadline_day: data.paymentDeadlineDay,
    late_penalty_percent: data.latePenaltyPercent,
    require_approval: data.requireApproval,
    contributions_visible: data.contributionsVisible,
    invite_code: inviteCode,
    is_active: true,
    member_count: 1,
    collected_amount: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await setDoc(doc(db, 'groups', groupId, 'members', adminUid), {
    uid: adminUid,
    role: 'admin',
    status: 'active',
    joined_at: serverTimestamp(),
  });

  await updateDoc(doc(db, 'users', adminUid), {
    active_group_id: groupId,
    role: 'admin',
    updated_at: serverTimestamp(),
  });

  return groupId;
}

// ─── getGroup ─────────────────────────────────────────────────────────────────

export async function getGroup(groupId: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fetchGroupConfig(groupId: string): Promise<GroupConfig> {
  const g = await getGroup(groupId);
  if (!g) throw new Error('GROUP_NOT_FOUND');
  return {
    name: g.name,
    description: g.description,
    photoUrl: g.photo_url,
    monthlyAmount: g.contribution_amount,
    currency: g.currency,
    dueDay: g.payment_deadline_day,
    penaltyEnabled: g.late_penalty_percent > 0,
    penaltyType: 'percentage',
    penaltyAmount: g.late_penalty_percent,
    requireApproval: g.require_approval,
    paymentsVisible: g.contributions_visible,
    treasurerName: g.treasurer_name,
    treasurerPhone: g.treasurer_phone,
    treasurerOperator: g.treasurer_operator,
  };
}

// ─── updateGroup ──────────────────────────────────────────────────────────────

export async function updateGroup(groupId: string, data: Partial<GroupData>, adminUid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error('GROUP_NOT_FOUND');
  if (group.admin_uid !== adminUid) throw new Error('UNAUTHORIZED');
  await updateDoc(doc(db, 'groups', groupId), { ...data, updated_at: serverTimestamp() });
}

// ─── getGroupMembers / fetchGroupMembers (alias) ───────────────────────────────

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const month = currentMonth();
  const contribSnap = await getDocs(
    query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('period_month', '==', month))
  );
  const contribMap: Record<string, string> = {};
  contribSnap.docs.forEach(d => { contribMap[d.data().member_uid] = d.data().status; });

  return snap.docs.map(d => ({
    uid: d.id,
    ...d.data(),
    paymentStatus: contribMap[d.id] ?? 'pending',
  })) as GroupMember[];
}

// Alias utilisé par MemberManagementScreen
export const fetchGroupMembers = getGroupMembers;

// ─── joinGroupByCode ──────────────────────────────────────────────────────────

export async function joinGroupByCode(inviteCode: string, userUid: string): Promise<string> {
  const snap = await getDocs(
    query(collection(db, 'groups'),
      where('invite_code', '==', inviteCode.toUpperCase()),
      where('is_active', '==', true))
  );
  if (snap.empty) throw new Error('INVALID_CODE');

  const groupDoc = snap.docs[0];
  const groupId = groupDoc.id;
  const groupData = groupDoc.data();

  const memberSnap = await getDoc(doc(db, 'groups', groupId, 'members', userUid));
  if (memberSnap.exists()) throw new Error('ALREADY_MEMBER');

  if (!groupData.require_approval) {
    await setDoc(doc(db, 'groups', groupId, 'members', userUid), {
      uid: userUid, role: 'member', status: 'active', joined_at: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', userUid), {
      active_group_id: groupId, updated_at: serverTimestamp(),
    });
    await updateDoc(doc(db, 'groups', groupId), {
      member_count: (groupData.member_count || 0) + 1, updated_at: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db, 'notifications'), {
      recipient_uid: groupData.admin_uid,
      type: 'join_request',
      title: "Demande d'adhésion",
      body: `Un nouveau membre souhaite rejoindre ${groupData.name}`,
      data: { group_id: groupId, user_uid: userUid },
      is_read: false,
      created_at: serverTimestamp(),
    });
  }

  return groupId;
}

// ─── fetchInviteCode ──────────────────────────────────────────────────────────

export async function fetchInviteCode(groupId: string): Promise<InviteCode> {
  const group = await getGroup(groupId);
  if (!group) throw new Error('GROUP_NOT_FOUND');
  return {
    code: group.invite_code ?? '',
    link: `https://contributapp.rdc/join?code=${group.invite_code ?? ''}`,
    expiresAt: null,
  };
}

// ─── regenerateInviteCode ─────────────────────────────────────────────────────

export async function regenerateInviteCode(groupId: string, adminUid?: string): Promise<InviteCode> {
  if (adminUid) {
    const group = await getGroup(groupId);
    if (!group || group.admin_uid !== adminUid) throw new Error('UNAUTHORIZED');
  }
  const newCode = generateInviteCode();
  await updateDoc(doc(db, 'groups', groupId), { invite_code: newCode, updated_at: serverTimestamp() });
  return {
    code: newCode,
    link: `https://contributapp.rdc/join?code=${newCode}`,
    expiresAt: null,
  };
}

// ─── fetchPendingInvitations ──────────────────────────────────────────────────

export async function fetchPendingInvitations(groupId: string): Promise<PendingInvitation[]> {
  const snap = await getDocs(
    query(collection(db, 'notifications'),
      where('type', '==', 'join_request'),
      where('data.group_id', '==', groupId),
      where('is_read', '==', false))
  );
  return snap.docs.map(d => ({
    id: d.id,
    phone: d.data().data?.user_uid ?? '',
    sentAt: d.data().created_at,
    status: 'pending',
  }));
}

// Alias utilisé par MemberManagementScreen
export const getPendingInvitations = fetchPendingInvitations;

// ─── cancelInvitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(groupId: string, invitationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', invitationId));
}

// ─── sendSmsInvite (stub — le SMS est géré côté Worker) ──────────────────────

export async function sendSmsInvite(groupId: string, phone: string): Promise<void> {
  // Crée une notification de demande en attente dans Firestore
  const group = await getGroup(groupId);
  if (!group) throw new Error('GROUP_NOT_FOUND');
  await addDoc(collection(db, 'notifications'), {
    recipient_uid: group.admin_uid,
    type: 'join_request',
    title: 'Invitation envoyée',
    body: `Invitation envoyée à ${phone} pour rejoindre ${group.name}`,
    data: { group_id: groupId, invited_phone: phone },
    is_read: false,
    created_at: serverTimestamp(),
  });
}

// ─── remindMember ─────────────────────────────────────────────────────────────

export async function remindMember(groupId: string, memberUid: string): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    recipient_uid: memberUid,
    type: 'reminder',
    title: '⏰ Rappel de cotisation',
    body: 'Votre contribution du mois est en attente.',
    data: { group_id: groupId },
    is_read: false,
    created_at: serverTimestamp(),
  });
}

// ─── getGroupDashboard ────────────────────────────────────────────────────────

export async function getGroupDashboard(groupId: string): Promise<any> {
  const month = currentMonth();
  const [membersSnap, contribSnap] = await Promise.all([
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('period_month', '==', month))),
  ]);
  const paidContribs = contribSnap.docs.filter(d => d.data().status === 'paid');
  return {
    totalMembers: membersSnap.size,
    paidCount: paidContribs.length,
    collectedAmount: paidContribs.reduce((s, d) => s + (d.data().amount_paid || 0), 0),
    pendingCount: contribSnap.docs.filter(d => d.data().status === 'pending_approval').length,
    lateCount: contribSnap.docs.filter(d => d.data().status === 'late').length,
  };
}

// ─── subscribeToGroupDashboard ────────────────────────────────────────────────

export function subscribeToGroupDashboard(groupId: string, callback: (data: any) => void): () => void {
  const month = currentMonth();
  return onSnapshot(
    query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('period_month', '==', month)),
    (snap) => {
      const paid = snap.docs.filter(d => d.data().status === 'paid');
      callback({
        paidCount: paid.length,
        collectedAmount: paid.reduce((s, d) => s + (d.data().amount_paid || 0), 0),
        pendingCount: snap.docs.filter(d => d.data().status === 'pending_approval').length,
      });
    }
  );
}

// ─── updateMemberRole ─────────────────────────────────────────────────────────

export async function updateMemberRole(
  groupId: string, targetUid: string, newRole: string, adminUid: string
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.admin_uid !== adminUid) throw new Error('UNAUTHORIZED');
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), {
    role: newRole, updated_at: serverTimestamp(),
  });
  if (newRole === 'treasurer') {
    if (group.treasurer_uid && group.treasurer_uid !== targetUid) {
      await updateDoc(doc(db, 'groups', groupId, 'members', group.treasurer_uid), { role: 'member' });
    }
    await updateDoc(doc(db, 'groups', groupId), {
      treasurer_uid: targetUid, updated_at: serverTimestamp(),
    });
  }
}

// ─── updateMemberStatus ───────────────────────────────────────────────────────

export async function updateMemberStatus(
  groupId: string, targetUid: string, newStatus: string, adminUid: string
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.admin_uid !== adminUid) throw new Error('UNAUTHORIZED');
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), {
    status: newStatus, updated_at: serverTimestamp(),
  });
}

// ─── Helpers legacy (compatibilité dashboards existants) ──────────────────────

export async function getGroupForMember(userId: string): Promise<any | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const groupId = userDoc.data().active_group_id;
  if (!groupId) return null;
  return getGroup(groupId);
}

export async function getGroupForAdmin(userId: string): Promise<any | null> {
  const snap = await getDocs(
    query(collection(db, 'groups'), where('admin_uid', '==', userId), where('is_active', '==', true))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getGroupByInviteCode(code: string): Promise<any | null> {
  const snap = await getDocs(
    query(collection(db, 'groups'), where('invite_code', '==', code.toUpperCase()))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function isAlreadyMember(userId: string, groupId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'members', userId));
  return snap.exists();
}

export async function joinGroup(userId: string, groupId: string): Promise<void> {
  await joinGroupByCode('', userId); // passthrough
  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    uid: userId, role: 'member', status: 'active', joined_at: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', userId), {
    active_group_id: groupId, updated_at: serverTimestamp(),
  });
}

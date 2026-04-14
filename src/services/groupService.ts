import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, increment
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';


export type MemberRole = 'admin' | 'treasurer' | 'member' | 'auditor';
export type MemberStatus = 'active' | 'suspended' | 'removed' | 'invited';

export interface GroupConfig {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string | null;
  monthlyAmount: number;
  currency: 'CDF' | 'USD';
  dueDay: number;
  penaltyEnabled: boolean;
  penaltyType: 'fixed' | 'percentage';
  penaltyAmount: number;
  requireApproval: boolean;
  paymentsVisible: boolean;
  treasurerName?: string;
  treasurerPhone?: string;
  treasurerOperator?: string;
  inviteCode?: string;
  adminUid?: string;
}

export interface GroupMember {
  id: string;
  fullName: string;
  avatar: string | null;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  paymentStatus: 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC' | 'PARTIEL' | null;
  joinDate: string;
}

export interface DashboardData {
  collected_amount: number;
  expected_amount: number;
  paid_count: number;
  total_members: number;
  late_members: any[];
}

function generateId(): string {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createGroup(payload: Partial<GroupConfig>): Promise<string> {
  const groupId = generateId();
  const inviteCode = generateInviteCode();
  const uid = auth.currentUser?.uid || 'user_dev';
  
  // Remplacer par des vraies valeurs ou defaults
  const groupData = {
    name: payload.name || 'Nouveau Groupe',
    description: payload.description || '',
    photo_url: payload.photoUrl || null,
    admin_uid: uid,
    treasurer_uid: uid,
    treasurer_phone: payload.treasurerPhone || '',
    treasurer_operator: payload.treasurerOperator || 'airtel',
    contribution_amount: payload.monthlyAmount || 0,
    currency: payload.currency || 'CDF',
    payment_deadline_day: payload.dueDay || 1,
    late_penalty_percent: payload.penaltyAmount || 0,
    require_approval: payload.requireApproval ?? false,
    contributions_visible: payload.paymentsVisible ?? true,
    invite_code: inviteCode,
    is_active: true,
    member_count: 1,
  };

  const memberData = {
    uid,
    full_name: 'Creator', // Pour simplifier
    phone: '',
    operator: 'airtel',
    role: 'admin',
    status: 'active'
  };

  await setDoc(doc(db, 'groups', groupId), {
     ...groupData,
     created_at: serverTimestamp()
  });

  await setDoc(doc(db, 'groups', groupId, 'members', uid), {
     ...memberData,
     joined_at: serverTimestamp()
  });

  return groupId;
}

export async function getGroup(groupId: string): Promise<GroupConfig> {
  const docRef = await getDoc(doc(db, 'groups', groupId));
  if (!docRef.exists()) throw new Error('Group not found');
  const row = docRef.data();
  return {
     id: docRef.id,
     name: row.name,
     description: row.description,
     photoUrl: row.photo_url,
     monthlyAmount: row.contribution_amount,
     currency: row.currency,
     dueDay: row.payment_deadline_day,
     penaltyEnabled: row.late_penalty_percent > 0,
     penaltyType: 'percentage',
     penaltyAmount: row.late_penalty_percent,
     requireApproval: row.require_approval,
     paymentsVisible: row.contributions_visible,
     adminUid: row.admin_uid,
     inviteCode: row.invite_code
  };
}

export async function updateGroup(groupId: string, data: Partial<GroupConfig>): Promise<void> {
  const uid = auth.currentUser?.uid || 'user_dev';
  
  const docRef = doc(db, 'groups', groupId);
  const grpDoc = await getDoc(docRef);
  if (!grpDoc.exists() || grpDoc.data().admin_uid !== uid) throw new Error('Not authorized');
  
  const fbUpdates: any = {};
  if (data.name !== undefined) fbUpdates.name = data.name;
  if (data.description !== undefined) fbUpdates.description = data.description;
  
  if (Object.keys(fbUpdates).length > 0) {
    await updateDoc(docRef, fbUpdates);
  }
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: data.uid,
      fullName: data.full_name,
      avatar: null,
      phone: data.phone,
      role: data.role,
      status: data.status,
      paymentStatus: null,
      joinDate: data.joined_at?.toDate().toISOString()
    };
  });
}

export async function joinGroupByCode(inviteCode: string): Promise<string> {
  const uid = auth.currentUser?.uid || 'user_dev';

  const q = query(collection(db, 'groups'), where('invite_code', '==', inviteCode), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Group not found');
  
  const grpDoc = snap.docs[0];
  const grpData = grpDoc.data();
  
  // On suppose que les details userInfo sont passes d'une facon ou d'une autre (ex depuis le store)
  await setDoc(doc(db, 'groups', grpDoc.id, 'members', uid), {
      uid,
      full_name: 'New Member', // placeholder
      phone: '',
      operator: 'airtel',
      role: 'member',
      status: grpData.require_approval ? 'invited' : 'active',
      joined_at: serverTimestamp()
  });
  
  return grpDoc.id;
}

export async function getGroupDashboard(groupId: string): Promise<DashboardData> {
  // TODO: Add complex Firestore aggregation for contributions of the month
  return {
    collected_amount: 0,
    expected_amount: 0,
    paid_count: 0,
    total_members: 0,
    late_members: []
  };
}

export function subscribeToGroupDashboard(groupId: string, callback: (data: DashboardData) => void): () => void {
  // Simplification for firestore
  const unsubscribe = onSnapshot(doc(db, 'groups', groupId), (docSnap) => {
     getGroupDashboard(groupId).then(callback);
  });
  return unsubscribe;
}

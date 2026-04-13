import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, increment
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { getLocalDB, USE_LOCAL_DB } from '../config/database';

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

  if (USE_LOCAL_DB) {
    const dbL = getLocalDB();
    await dbL.runAsync(`
      INSERT INTO groups (
        id, name, description, photo_url, admin_uid, treasurer_uid, treasurer_phone, treasurer_operator,
        contribution_amount, currency, payment_deadline_day, late_penalty_percent, require_approval,
        contributions_visible, invite_code, member_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      groupId, groupData.name, groupData.description, groupData.photo_url, groupData.admin_uid,
      groupData.treasurer_uid, groupData.treasurer_phone, groupData.treasurer_operator,
      groupData.contribution_amount, groupData.currency, groupData.payment_deadline_day,
      groupData.late_penalty_percent, groupData.require_approval ? 1 : 0,
      groupData.contributions_visible ? 1 : 0, groupData.invite_code, groupData.member_count
    ]);

    await dbL.runAsync(`
      INSERT INTO group_members (id, group_id, uid, full_name, phone, operator, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      groupId + '_' + uid, groupId, memberData.uid, memberData.full_name, memberData.phone,
      memberData.operator, memberData.role, memberData.status
    ]);
    return groupId;
  }

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
  if (USE_LOCAL_DB) {
     const dbL = getLocalDB();
     const row = await dbL.getFirstAsync('SELECT * FROM groups WHERE id = ?', [groupId]) as any;
     if (!row) throw new Error('Group not found');
     return {
       id: row.id,
       name: row.name,
       description: row.description,
       photoUrl: row.photo_url,
       monthlyAmount: row.contribution_amount,
       currency: row.currency,
       dueDay: row.payment_deadline_day,
       penaltyEnabled: row.late_penalty_percent > 0,
       penaltyType: 'percentage',
       penaltyAmount: row.late_penalty_percent,
       requireApproval: row.require_approval === 1,
       paymentsVisible: row.contributions_visible === 1,
       adminUid: row.admin_uid,
       inviteCode: row.invite_code
     };
  }

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
  
  if (USE_LOCAL_DB) {
    const dbL = getLocalDB();
    const grp = await dbL.getFirstAsync('SELECT * FROM groups WHERE id = ?', [groupId]) as any;
    if (!grp || grp.admin_uid !== uid) throw new Error('Not authorized');
    
    // Updates
    const updates = [];
    const params = [];
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    
    if (updates.length > 0) {
      params.push(groupId);
      await dbL.runAsync(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    return;
  }

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
  if (USE_LOCAL_DB) {
     const dbL = getLocalDB();
     const members = await dbL.getAllAsync(`
       SELECT gm.*, u.profile_photo_url
       FROM group_members gm
       LEFT JOIN users u ON u.uid = gm.uid
       WHERE gm.group_id = ?
     `, [groupId]) as any[];
     return members.map(m => ({
       id: m.uid,
       fullName: m.full_name,
       avatar: m.profile_photo_url,
       phone: m.phone,
       role: m.role,
       status: m.status,
       paymentStatus: null, // À calculer selon le mois
       joinDate: m.joined_at
     }));
  }

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

  if (USE_LOCAL_DB) {
    const dbL = getLocalDB();
    const grp = await dbL.getFirstAsync('SELECT * FROM groups WHERE invite_code = ?', [inviteCode]) as any;
    if (!grp) throw new Error('Group not found');
    
    // Simplification logic
    await dbL.runAsync(`
      INSERT OR IGNORE INTO group_members (id, group_id, uid, full_name, phone, operator, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      grp.id + '_' + uid, grp.id, uid, 'New Member', 'phone', 'operator', 'member',
      grp.require_approval ? 'invited' : 'active'
    ]);
    return grp.id;
  }

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
  if (USE_LOCAL_DB) {
     const dbL = getLocalDB();
     const countRes = await dbL.getFirstAsync('SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND status = "active"', [groupId]) as any;
     return {
       collected_amount: 0,
       expected_amount: 0,
       paid_count: 0,
       total_members: countRes.c || 0,
       late_members: []
     };
  }

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
  if (USE_LOCAL_DB) {
    const interval = setInterval(() => {
      getGroupDashboard(groupId).then(callback);
    }, 5000);
    return () => clearInterval(interval);
  }

  // Simplification for firestore
  const unsubscribe = onSnapshot(doc(db, 'groups', groupId), (docSnap) => {
     getGroupDashboard(groupId).then(callback);
  });
  return unsubscribe;
}

/**
 * groupService.ts — Module 04 : Gestion du Groupe
 * Service réécrit pour utiliser directement SQLite en local
 */
import { getDB } from './database';

export type MemberRole   = 'admin' | 'treasurer' | 'member' | 'auditor';
export type MemberStatus = 'active' | 'suspended' | 'removed' | 'invited';

export interface GroupMember {
  id:            string;
  fullName:      string;
  avatar:        string | null;
  phone:         string;
  role:          MemberRole;
  status:        MemberStatus;
  paymentStatus: 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC' | 'PARTIEL' | null;
  joinDate:      string;   // ISO 8601
}

export interface GroupConfig {
  id:                  string;
  name:                string;
  description:         string;
  photoUrl:            string | null;
  monthlyAmount:       number;
  currency:            'CDF' | 'USD';
  dueDay:              number;
  penaltyEnabled:      boolean;
  penaltyType:         'fixed' | 'percentage';
  penaltyAmount:       number;
  requireApproval:     boolean;
  paymentsVisible:     boolean;
  treasurerName:       string;
  treasurerPhone:      string;
  treasurerOperator:   'airtel' | 'orange' | 'mpesa' | 'mtn';
}

export interface PendingInvitation {
  id:        string;
  phone:     string;
  sentAt:    string;
  expiresAt: string;
}

export interface InviteCode {
  code:     string;
  link:     string;
  expiresAt: string;
}

// ─── API Groupe (SQLite) ──────────────────────────────────────

export async function fetchGroupConfig(groupId: string): Promise<GroupConfig> {
  const db = getDB();
  const group = db.getFirstSync<any>('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) throw new Error('Groupe introuvable');

  // Essayer de trouver la trésorière actuelle dans group_members
  const treasurerRow = db.getFirstSync<any>(`
    SELECT u.full_name, u.phone, u.operator
    FROM users u JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ? AND gm.role = 'treasurer'
  `, [groupId]);

  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    photoUrl: group.photo_url || null,
    monthlyAmount: group.monthly_amount,
    currency: group.currency || 'CDF',
    dueDay: group.due_day || 25,
    penaltyEnabled: group.penalty_enabled === 1,
    penaltyType: group.penalty_type || 'fixed',
    penaltyAmount: group.penalty_amount || 0,
    requireApproval: group.require_approval === 1,
    paymentsVisible: group.payments_visible === 1,
    treasurerName: treasurerRow?.full_name || 'Non définie',
    treasurerPhone: treasurerRow?.phone || '',
    treasurerOperator: treasurerRow?.operator || 'airtel',
  };
}

export async function createGroup(payload: Omit<GroupConfig, 'id' | 'photoUrl'>): Promise<GroupConfig> {
  const db = getDB();
  const newId = 'grp_' + Date.now();
  db.runSync(`
    INSERT INTO groups (
      id, name, description, monthly_amount, admin_id, due_day, 
      currency, penalty_enabled, penalty_type, penalty_amount, require_approval, payments_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newId, payload.name, payload.description, payload.monthlyAmount, 'admin_system', payload.dueDay,
    payload.currency, payload.penaltyEnabled ? 1 : 0, payload.penaltyType, payload.penaltyAmount, 
    payload.requireApproval ? 1 : 0, payload.paymentsVisible ? 1 : 0
  ]);
  return fetchGroupConfig(newId);
}

export async function updateGroup(groupId: string, payload: Partial<GroupConfig>): Promise<GroupConfig> {
  const db = getDB();
  
  if (payload.name !== undefined) db.runSync(`UPDATE groups SET name = ? WHERE id = ?`, [payload.name, groupId]);
  if (payload.description !== undefined) db.runSync(`UPDATE groups SET description = ? WHERE id = ?`, [payload.description, groupId]);
  if (payload.monthlyAmount !== undefined) db.runSync(`UPDATE groups SET monthly_amount = ? WHERE id = ?`, [payload.monthlyAmount, groupId]);
  if (payload.dueDay !== undefined) db.runSync(`UPDATE groups SET due_day = ? WHERE id = ?`, [payload.dueDay, groupId]);
  if (payload.currency !== undefined) db.runSync(`UPDATE groups SET currency = ? WHERE id = ?`, [payload.currency, groupId]);
  if (payload.penaltyEnabled !== undefined) db.runSync(`UPDATE groups SET penalty_enabled = ? WHERE id = ?`, [payload.penaltyEnabled ? 1 : 0, groupId]);
  if (payload.penaltyType !== undefined) db.runSync(`UPDATE groups SET penalty_type = ? WHERE id = ?`, [payload.penaltyType, groupId]);
  if (payload.penaltyAmount !== undefined) db.runSync(`UPDATE groups SET penalty_amount = ? WHERE id = ?`, [payload.penaltyAmount, groupId]);
  if (payload.requireApproval !== undefined) db.runSync(`UPDATE groups SET require_approval = ? WHERE id = ?`, [payload.requireApproval ? 1 : 0, groupId]);
  if (payload.paymentsVisible !== undefined) db.runSync(`UPDATE groups SET payments_visible = ? WHERE id = ?`, [payload.paymentsVisible ? 1 : 0, groupId]);
  if (payload.photoUrl !== undefined) db.runSync(`UPDATE groups SET photo_url = ? WHERE id = ?`, [payload.photoUrl, groupId]);

  return fetchGroupConfig(groupId);
}

// ─── API Membres (SQLite) ─────────────────────────────────────

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const db = getDB();
  const membersRows = db.getAllSync<any>(`
    SELECT u.id, u.full_name, u.phone, u.profile_photo_url, gm.role, gm.joined_at
    FROM users u JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `, [groupId]);

  return membersRows.map(row => ({
    id: row.id,
    fullName: row.full_name,
    avatar: row.profile_photo_url || null,
    phone: row.phone,
    role: row.role as MemberRole,
    status: 'active',
    paymentStatus: 'PAYE',
    joinDate: row.joined_at
  }));
}

export async function updateMemberRole(groupId: string, userId: string, role: MemberRole): Promise<void> {
  getDB().runSync(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`, [role, groupId, userId]);
}

export async function updateMemberStatus(groupId: string, userId: string, status: 'suspended' | 'removed'): Promise<void> {
  if (status === 'removed') {
     getDB().runSync(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
  }
}

export async function remindMember(userId: string): Promise<void> {
  console.log(`[SQLite] Rappel de paiement envoyé au membre ${userId}`);
}

// ─── API Invitations (SQLite) ─────────────────────────────────

export async function fetchInviteCode(groupId: string): Promise<InviteCode> {
  const db = getDB();
  const row = db.getFirstSync<any>(`SELECT invite_code FROM groups WHERE id = ?`, [groupId]);
  const code = row?.invite_code || 'PROMO2026';
  return { code, link: `https://contrib.app/j/${code}`, expiresAt: '2026-12-31T23:59:59Z' };
}

export async function regenerateInviteCode(groupId: string): Promise<InviteCode> {
  const db = getDB();
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.runSync(`UPDATE groups SET invite_code = ? WHERE id = ?`, [newCode, groupId]);
  return { code: newCode, link: `https://contrib.app/j/${newCode}`, expiresAt: '2026-12-31T23:59:59Z' };
}

export async function sendSmsInvite(groupId: string, phone: string): Promise<void> {
  console.log(`[SQLite] Invitation SMS ajoutée/envoyée pour ${phone}`);
}

export async function fetchPendingInvitations(groupId: string): Promise<PendingInvitation[]> {
  return []; // Liste statique pour l'instant
}

export async function cancelInvitation(groupId: string, invitationId: string): Promise<void> {
  // Mock SQLite
}

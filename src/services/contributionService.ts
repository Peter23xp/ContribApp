/**
 * contributionService.ts
 * Service local pour les contributions / paiements
 * Fonctionne 100% avec SQLite, sans API externe
 */
import type { PaymentStatus } from '../components/common/StatusBadge';
import * as db from './database';

// ─── Types ───────────────────────────────────────────────────

export type ContributionFilter = 'all' | PaymentStatus;

export interface ContributionItem {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  amount: number;
  currency: 'CDF' | 'USD';
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
  paidAt: string | null;
  status: PaymentStatus;
  txReference: string;
  errorMessage?: string;
  memberPhone?: string;
}

export interface ContributionSummary {
  collectedAmount: number;
  expectedAmount:  number;
  totalMembers:    number;
  paidCount:       number;
  pendingCount:    number;
  lateCount:       number;
  failedCount:     number;
}

export interface ContributionsPage {
  items:    ContributionItem[];
  summary:  ContributionSummary;
  page:     number;
  limit:    number;
  hasMore:  boolean;
  total:    number;
}

export type ContributionSort = 'date_desc' | 'date_asc' | 'name_asc' | 'amount_desc';

export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

export interface CurrentMonthStatus {
  alreadyPaid: boolean;
  amount?: number;
  paidAt?: string;
  txId?: string;
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
}

export interface InitiatePaymentRequest {
  group_id: string;
  member_id: string;
  amount: number;
  operator: string;
  payer_phone: string;
}

export interface InitiatePaymentResponse {
  txId: string;
  status: TxStatus;
}

export interface TransactionStatusResponse {
  txId: string;
  status: TxStatus;
  errorMessage?: string;
}

export interface ExportUrlResponse {
  downloadUrl: string;
}

export interface ReceiptDetail {
  receiptNumber:  string;
  txId:           string;
  groupName:      string;
  period:         string;
  memberName:     string;
  memberPhone:    string;
  operator:       'airtel' | 'orange' | 'mpesa' | 'mtn';
  baseAmount:     number;
  penaltyAmount:  number;
  totalAmount:    number;
  treasurerName:  string;
  treasurerAccount: string;
  paidAt:         string;
}

export interface PdfUrlResponse {
  downloadUrl: string;
  expiresAt:   string;
}

export interface MemberYearHistoryResponse {
  year: number;
  summary: {
    paidMonths: number;
    totalPaid: number;
    currency: 'CDF' | 'USD';
    totalMonthsAsMember: number;
  };
  stats: {
    streak: number;
    punctualityRate: number;
    bestStreak: number;
  };
  months: Array<{
    month: string;
    status: 'PAYE' | 'EN_RETARD' | 'MANQUANT' | 'AVANT_INSCRIPTION';
    amount: number | null;
    txId: string | null;
    isFuture?: boolean;
  }>;
}

export interface ContributionDetail {
  txId: string;
  paidAt: string | null;
  amount: number;
  penaltyAmount: number;
  totalAmount: number;
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
  txReference: string;
  status: PaymentStatus;
}

export interface MonthlyReportResponse {
  period: string;
  summary: {
    expectedAmount: number;
    collectedAmount: number;
    missingAmount: number;
    participationRate: number;
    paidCount: number;
    totalMembers: number;
    lateCount: number;
  };
  contributions: Array<{
    memberId: string;
    memberName: string;
    amount: number;
    operator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
    paidAt: string | null;
    status: PaymentStatus;
    txId: string;
  }>;
  unpaidMembers: Array<{
    memberId: string;
    memberName: string;
    amountDue: number;
  }>;
}

export interface MonthlyStatPoint {
  month: string;
  collectedAmount: number;
  expectedAmount: number;
  paidCount: number;
  totalMembers: number;
}

// ─── Implémentations locales SQLite ──────────────────────────

export async function fetchGroupContributions(
  groupId: string,
  month: string,
  filter: ContributionFilter = 'all',
  page  = 1,
  limit = 20,
  options?: { memberId?: string | null; sort?: ContributionSort },
): Promise<ContributionsPage> {
  const contributions = db.getContributionsForMonth(groupId, month);
  
  // Filtrer par statut si nécessaire
  let filtered = filter === 'all' 
    ? contributions 
    : contributions.filter((c: any) => c.status === filter);

  // Filtrer par membre si fourni
  if (options?.memberId) {
    filtered = filtered.filter((c: any) => c.user_id === options.memberId);
  }

  // Trier (simulation tri serveur)
  const sort = options?.sort ?? 'date_desc';
  filtered = [...filtered].sort((a: any, b: any) => {
    if (sort === 'name_asc') {
      return String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''), 'fr');
    }
    if (sort === 'amount_desc') {
      return Number(b.amount ?? 0) - Number(a.amount ?? 0);
    }

    const aTs = a.paid_at ? new Date(a.paid_at).getTime() : 0;
    const bTs = b.paid_at ? new Date(b.paid_at).getTime() : 0;
    if (sort === 'date_asc') {
      return aTs - bTs;
    }
    return bTs - aTs;
  });
  
  // Pagination
  const offset = (page - 1) * limit;
  const paginatedItems = filtered.slice(offset, offset + limit);
  
  // Mapper vers ContributionItem
  const items: ContributionItem[] = paginatedItems.map((c: any) => ({
    id: c.id,
    memberId: c.user_id,
    memberName: c.full_name || 'Inconnu',
    memberAvatar: null,
    amount: c.amount,
    currency: 'CDF',
    operator: c.operator || null,
    paidAt: c.paid_at || null,
    status: c.status as PaymentStatus,
    txReference: c.tx_id || c.id,
    memberPhone: c.phone,
  }));
  
  // Calculer le résumé
  const paidCount = contributions.filter((c: any) => c.status === 'PAYE').length;
  const pendingCount = contributions.filter((c: any) => c.status === 'EN_ATTENTE').length;
  const lateCount = contributions.filter((c: any) => c.status === 'EN_RETARD').length;
  const failedCount = contributions.filter((c: any) => c.status === 'ECHEC').length;
  
  const collectedAmount = contributions
    .filter((c: any) => c.status === 'PAYE')
    .reduce((sum: number, c: any) => sum + c.amount, 0);
  
  const expectedAmount = contributions.reduce((sum: number, c: any) => sum + c.amount, 0);
  
  const summary: ContributionSummary = {
    collectedAmount,
    expectedAmount,
    totalMembers: contributions.length,
    paidCount,
    pendingCount,
    lateCount,
    failedCount,
  };
  
  return {
    items,
    summary,
    page,
    limit,
    hasMore: offset + limit < filtered.length,
    total: filtered.length,
  };
}

export async function fetchPaidContributions(
  groupId: string,
  month: string,
  page  = 1,
  limit = 20,
): Promise<ContributionsPage> {
  return fetchGroupContributions(groupId, month, 'PAYE', page, limit);
}

export async function exportContributions(
  groupId: string,
  month: string,
  format: 'xlsx' | 'csv' = 'xlsx',
): Promise<ExportUrlResponse> {
  // En local, on génère juste une URL fictive
  // Dans une vraie app, on générerait un fichier Excel/CSV
  console.log(`[LOCAL] Export ${format} pour groupe ${groupId}, mois ${month}`);
  return {
    downloadUrl: `file://exports/${groupId}_${month}.${format}`,
  };
}

export async function checkCurrentMonthStatus(
  groupId: string,
  memberId: string,
): Promise<CurrentMonthStatus> {
  const contribution = db.getMemberContribution(memberId, groupId);
  const group = db.getDB().getFirstSync<any>('SELECT * FROM groups WHERE id = ?', [groupId]);
  
  if (!contribution) {
    // Pas de contribution pour ce mois
    return {
      alreadyPaid: false,
      baseAmount: group?.monthly_amount || 0,
      penaltyAmount: 0,
      totalAmount: group?.monthly_amount || 0,
    };
  }
  
  const alreadyPaid = contribution.status === 'PAYE';
  
  return {
    alreadyPaid,
    amount: alreadyPaid ? contribution.amount : undefined,
    paidAt: alreadyPaid ? contribution.paid_at : undefined,
    txId: alreadyPaid ? contribution.tx_id : undefined,
    baseAmount: contribution.amount,
    penaltyAmount: contribution.penalty_amount || 0,
    totalAmount: contribution.amount + (contribution.penalty_amount || 0),
  };
}

export async function initiatePayment(
  req: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  // Simulation de paiement local
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  console.log('[LOCAL] Initiation paiement:', {
    txId,
    groupId: req.group_id,
    memberId: req.member_id,
    amount: req.amount,
    operator: req.operator,
  });
  
  // Simuler un délai
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    txId,
    status: 'pending',
  };
}

export async function pollTransactionStatus(
  txId: string,
): Promise<TransactionStatusResponse> {
  // Simulation : après 3 secondes, le paiement est confirmé
  console.log('[LOCAL] Vérification statut transaction:', txId);
  
  // En local, on confirme automatiquement après un délai
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    txId,
    status: 'confirmed',
  };
}

export async function sendMemberReminder(memberId: string): Promise<void> {
  console.log('[LOCAL] Rappel envoyé au membre:', memberId);
  // En local, on ne fait rien
}

export async function sendGroupRemindAll(groupId: string): Promise<void> {
  console.log('[LOCAL] Rappel envoyé à tous les membres du groupe:', groupId);
  // En local, on ne fait rien
}

export async function fetchReceiptDetail(txId: string): Promise<ReceiptDetail> {
  // Récupérer la contribution depuis la DB
  const contribution = db.getDB().getFirstSync<any>(
    `SELECT c.*, u.full_name, u.phone, g.name as group_name 
     FROM contributions c
     JOIN users u ON c.user_id = u.id
     JOIN groups g ON c.group_id = g.id
     WHERE c.tx_id = ? OR c.id = ?`,
    [txId, txId]
  );
  
  if (!contribution) {
    throw new Error('Transaction introuvable');
  }
  
  // Récupérer la trésorière
  const treasurer = db.getDB().getFirstSync<any>(
    `SELECT u.full_name, u.phone 
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ? AND gm.role = 'treasurer'`,
    [contribution.group_id]
  );
  
  return {
    receiptNumber: `REC-${txId.slice(-8).toUpperCase()}`,
    txId,
    groupName: contribution.group_name,
    period: contribution.month,
    memberName: contribution.full_name,
    memberPhone: contribution.phone,
    operator: contribution.operator || 'airtel',
    baseAmount: contribution.amount,
    penaltyAmount: contribution.penalty_amount || 0,
    totalAmount: contribution.amount + (contribution.penalty_amount || 0),
    treasurerName: treasurer?.full_name || 'Trésorière',
    treasurerAccount: treasurer?.phone || '',
    paidAt: contribution.paid_at || new Date().toISOString(),
  };
}

export async function fetchReceiptPdfUrl(txId: string): Promise<PdfUrlResponse> {
  // En local, on génère juste une URL fictive
  console.log('[LOCAL] Génération PDF pour transaction:', txId);
  return {
    downloadUrl: `file://receipts/${txId}.pdf`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function fetchMemberHistoryByYear(
  groupId: string,
  memberId: string,
  year: number,
): Promise<MemberYearHistoryResponse> {
  const database = db.getDB();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const membership = database.getFirstSync<any>(
    `SELECT joined_at FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
    [groupId, memberId],
  );
  const joinedAt = membership?.joined_at ? new Date(membership.joined_at) : new Date(`${year}-01-01`);
  const joinedYear = joinedAt.getFullYear();
  const joinedMonth = joinedAt.getMonth() + 1;

  const rows = database.getAllSync<any>(
    `SELECT * FROM contributions WHERE group_id = ? AND user_id = ? AND month LIKE ?`,
    [groupId, memberId, `${year}-%`],
  );

  const monthMap = new Map<string, any>();
  rows.forEach((row: any) => monthMap.set(row.month, row));

  const months: MemberYearHistoryResponse['months'] = [];
  for (let m = 1; m <= 12; m += 1) {
    const monthKey = `${year}-${`${m}`.padStart(2, '0')}`;
    const isFuture = year > currentYear || (year === currentYear && m > currentMonth);
    const beforeMembership = year < joinedYear || (year === joinedYear && m < joinedMonth);

    if (beforeMembership) {
      months.push({ month: monthKey, status: 'AVANT_INSCRIPTION', amount: null, txId: null });
      continue;
    }

    if (isFuture) {
      months.push({ month: monthKey, status: 'MANQUANT', amount: null, txId: null, isFuture: true });
      continue;
    }

    const row = monthMap.get(monthKey);
    if (!row) {
      months.push({ month: monthKey, status: 'MANQUANT', amount: null, txId: null });
      continue;
    }

    const status = row.status === 'PAYE' ? 'PAYE' : row.status === 'EN_RETARD' ? 'EN_RETARD' : 'MANQUANT';
    months.push({
      month: monthKey,
      status,
      amount: status === 'PAYE' ? Number(row.amount ?? 0) : null,
      txId: row.tx_id ?? row.id ?? null,
    });
  }

  const paidMonths = months.filter((m) => m.status === 'PAYE').length;
  const totalPaid = months.reduce((sum, m) => sum + (m.status === 'PAYE' ? Number(m.amount ?? 0) : 0), 0);
  const totalMonthsAsMember = months.filter((m) => m.status !== 'AVANT_INSCRIPTION' && !m.isFuture).length;

  const punctualityRate = totalMonthsAsMember > 0 ? Math.round((paidMonths / totalMonthsAsMember) * 100) : 0;

  let streak = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  for (const month of months) {
    if (month.isFuture || month.status === 'AVANT_INSCRIPTION') continue;
    if (month.status === 'PAYE') {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      streak = currentStreak;
    } else {
      currentStreak = 0;
      streak = 0;
    }
  }

  return {
    year,
    summary: {
      paidMonths,
      totalPaid,
      currency: 'CDF',
      totalMonthsAsMember,
    },
    stats: {
      streak,
      punctualityRate,
      bestStreak,
    },
    months,
  };
}

export async function fetchContributionDetail(txId: string): Promise<ContributionDetail> {
  const database = db.getDB();
  const row = database.getFirstSync<any>(
    `SELECT * FROM contributions WHERE tx_id = ? OR id = ? LIMIT 1`,
    [txId, txId],
  );

  if (!row) {
    throw new Error('Contribution introuvable');
  }

  const baseAmount = Number(row.amount ?? 0);
  const penaltyAmount = Number(row.penalty_amount ?? 0);
  return {
    txId: row.tx_id ?? row.id,
    paidAt: row.paid_at ?? null,
    amount: baseAmount,
    penaltyAmount,
    totalAmount: baseAmount + penaltyAmount,
    operator: row.operator ?? null,
    txReference: row.tx_id ?? row.id,
    status: row.status as PaymentStatus,
  };
}

export async function fetchMonthlyReport(groupId: string, month: string): Promise<MonthlyReportResponse> {
  const database = db.getDB();
  const rows = database.getAllSync<any>(
    `SELECT c.*, u.full_name
     FROM contributions c
     JOIN users u ON c.user_id = u.id
     WHERE c.group_id = ? AND c.month = ?`,
    [groupId, month],
  );

  const contributions = rows.map((row: any) => ({
    memberId: row.user_id,
    memberName: row.full_name ?? 'Inconnu',
    amount: Number(row.amount ?? 0),
    operator: (row.operator ?? null) as 'airtel' | 'orange' | 'mpesa' | 'mtn' | null,
    paidAt: row.paid_at ?? null,
    status: row.status as PaymentStatus,
    txId: row.tx_id ?? row.id,
  }));

  const paidRows = rows.filter((r: any) => r.status === 'PAYE');
  const lateRows = rows.filter((r: any) => r.status === 'EN_RETARD');
  const unpaidRows = rows.filter((r: any) => r.status !== 'PAYE');

  const collectedAmount = paidRows.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
  const expectedAmount = rows.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
  const paidCount = paidRows.length;
  const totalMembers = rows.length;
  const missingAmount = Math.max(0, expectedAmount - collectedAmount);
  const participationRate = totalMembers > 0 ? Math.round((paidCount / totalMembers) * 100) : 0;

  return {
    period: month,
    summary: {
      expectedAmount,
      collectedAmount,
      missingAmount,
      participationRate,
      paidCount,
      totalMembers,
      lateCount: lateRows.length,
    },
    contributions,
    unpaidMembers: unpaidRows.map((r: any) => ({
      memberId: r.user_id,
      memberName: r.full_name ?? 'Inconnu',
      amountDue: Number(r.amount ?? 0) + Number(r.penalty_amount ?? 0),
    })),
  };
}

export async function fetchYearMonthlyStats(groupId: string, year: number): Promise<MonthlyStatPoint[]> {
  const months: MonthlyStatPoint[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const month = `${year}-${`${m}`.padStart(2, '0')}`;
    const report = await fetchMonthlyReport(groupId, month);
    months.push({
      month,
      collectedAmount: report.summary.collectedAmount,
      expectedAmount: report.summary.expectedAmount,
      paidCount: report.summary.paidCount,
      totalMembers: report.summary.totalMembers,
    });
  }
  return months;
}

export async function exportReportPdf(
  groupId: string,
  type: 'monthly' | 'quarterly' | 'yearly',
  periodKey: string,
): Promise<ExportUrlResponse> {
  console.log(`[LOCAL] Export PDF ${type} groupe ${groupId} periode ${periodKey}`);
  return {
    downloadUrl: `file://exports/report_${groupId}_${type}_${periodKey}.pdf`,
  };
}

export async function exportReportExcel(
  groupId: string,
  type: 'monthly' | 'quarterly' | 'yearly',
  periodKey: string,
): Promise<ExportUrlResponse> {
  console.log(`[LOCAL] Export Excel ${type} groupe ${groupId} periode ${periodKey}`);
  return {
    downloadUrl: `file://exports/report_${groupId}_${type}_${periodKey}.xlsx`,
  };
}

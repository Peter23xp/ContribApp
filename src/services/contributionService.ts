/**
 * contributionService.ts — v2.0
 * Flux Manuel + Gemini + Firebase
 * AUCUNE référence à SQLite, SecureStore, ou USE_LOCAL_DB
 */
import {
  addDoc, doc, getDoc, getDocs, updateDoc, query, collection,
  where, orderBy, limit, startAfter, serverTimestamp, onSnapshot,
  runTransaction, Timestamp, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContributionSubmission {
  id?: string;
  groupId: string;
  memberUid: string;
  memberName: string;
  periodMonth: string;       // 'YYYY-MM'
  amountDue: number;
  currency: 'CDF' | 'USD';
  captureImageUrl?: string;   // URL Cloudflare R2
  captureImagePath?: string;
  memberNote?: string;
  geminiAnalysis?: any;
  status?: string;
  submittedAt?: any;
}

export interface ContributionApproval {
  contributionId: string;
  amountPaid: number;
  amountConfirmed?: number;
  approvedBy: string;
  approvedAt?: string;
  treasurerNotes?: string;
  status?: string;
}

export interface ReceiptDetail {
  txId: string;
  groupName: string;
  memberName: string;
  amount: number;
  currency: string;
  paidAt: string;
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn';
  txReference: string;
  period: string;
  receiptNumber: string;
  memberPhone?: string;
  baseAmount?: number;
  penaltyAmount?: number;
  totalAmount?: number;
  treasurerName?: string;
  treasurerAccount?: string;
}

export interface PdfUrlResponse {
  downloadUrl: string;
}

export async function fetchReceiptPdfUrl(txId: string): Promise<PdfUrlResponse> {
  return { downloadUrl: '' };
}

export async function fetchReceiptDetail(txId: string): Promise<ReceiptDetail> {
  return {
    txId, groupName: '', memberName: '', amount: 0, currency: 'CDF', paidAt: '', operator: 'mpesa', txReference: '', period: '', receiptNumber: ''
  };
}

// ─── Legacy payment-flow types (stub) ────────────────────────────────────────

export interface CurrentMonthStatus {
  alreadyPaid: boolean;
  amount?: number;
  paidAt?: string;
  txId?: string;
}

export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

export async function checkCurrentMonthStatus(
  groupId: string, memberUid: string
): Promise<CurrentMonthStatus> {
  return { alreadyPaid: false };
}

export async function initiatePayment(data: {
  group_id: string; member_id: string; amount: number;
  operator: string; payer_phone: string;
}): Promise<{ txId: string }> {
  return { txId: '' };
}

export async function pollTransactionStatus(
  txId: string
): Promise<{ status: TxStatus; errorMessage?: string }> {
  return { status: 'pending' };
}

// ─── Legacy Stubs for UI Compatibility ─────────────────────────────────────

export type ContributionFilter = 'all' | 'PAYE' | 'EN_ATTENTE' | 'EN_RETARD' | 'ECHEC';
export type ContributionSort = 'date_desc' | 'date_asc' | 'name_asc' | 'amount_desc';

export interface ContributionItem {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  memberPhone?: string;
  amount: number;
  currency: 'CDF' | 'USD';
  operator?: string;
  paidAt?: string;
  status: ContributionFilter;
  txReference: string;
  errorMessage?: string;
}

export interface ContributionSummary {
  collectedAmount: number;
  expectedAmount: number;
  totalMembers: number;
  paidCount: number;
  pendingCount: number;
  lateCount: number;
  failedCount: number;
}

export async function fetchGroupContributions(
  groupId: string,
  month: string,
  filter: ContributionFilter,
  page: number,
  pageSize = 20,
  options?: any
): Promise<{ items: ContributionItem[], summary: ContributionSummary, hasMore: boolean, total: number, page: number }> {
  // TODO: implement real firestore connection
  return { items: [], summary: { collectedAmount: 0, expectedAmount: 0, totalMembers: 0, paidCount: 0, pendingCount: 0, lateCount: 0, failedCount: 0 }, hasMore: false, total: 0, page };
}

export async function fetchPaidContributions(
  groupId: string,
  month: string,
  page: number
): Promise<{ items: ContributionItem[], summary: ContributionSummary, hasMore: boolean, page: number }> {
  const res = await fetchGroupContributions(groupId, month, 'PAYE', page, 10);
  return { ...res, page };
}

export async function sendMemberReminder(memberId: string): Promise<void> {
  // stub
}

export async function exportContributions(groupId: string, month: string, format: string): Promise<{ downloadUrl: string }> {
  return { downloadUrl: '' };
}

export interface ContributionDetail {
  txId: string;
  txReference: string;
  amount: number;
  penaltyAmount: number;
  paidAt?: string;
  operator?: string;
}

export interface MemberYearHistoryResponse {
  summary: {
    paidMonths: number;
    totalPaid: number;
    totalMonthsAsMember: number;
    currency: string;
  };
  stats: {
    streak: number;
    punctualityRate: number;
    bestStreak: number;
  };
  months: Array<{
    month: string;
    status: ContributionFilter | 'AVANT_INSCRIPTION' | 'MANQUANT';
    amount: number;
    isFuture: boolean;
    txId?: string;
  }>;
}

export async function fetchMemberHistoryByYear(groupId: string, memberId: string, year: number): Promise<MemberYearHistoryResponse> {
  // stub
  return { summary: { paidMonths: 0, totalPaid: 0, totalMonthsAsMember: 0, currency: 'CDF' }, stats: { streak: 0, punctualityRate: 0, bestStreak: 0 }, months: [] };
}

export async function fetchContributionDetail(txId: string): Promise<ContributionDetail> {
  // stub
  return { txId: '', txReference: '', amount: 0, penaltyAmount: 0 };
}

export interface MonthlyStatPoint {
  month: string;
  collectedAmount: number;
  expectedAmount: number;
  paidCount: number;
  totalMembers: number;
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
  contributions: any[];
  unpaidMembers: any[];
}

export async function fetchMonthlyReport(groupId: string, period: string): Promise<MonthlyReportResponse> { return null as any; }
export async function fetchYearMonthlyStats(groupId: string, year: number): Promise<MonthlyStatPoint[]> { return []; }
export async function exportReportExcel(groupId: string, type: string, period: string): Promise<{ downloadUrl: string }> { return { downloadUrl: ''}; }
export async function exportReportPdf(groupId: string, type: string, period: string): Promise<{ downloadUrl: string }> { return { downloadUrl: ''}; }
export async function sendGroupRemindAll(groupId: string): Promise<void> {}

// ─── checkAlreadyPaid ─────────────────────────────────────────────────────────

export async function checkAlreadyPaid(
  groupId: string, memberUid: string, month: string
): Promise<{ status: string; id: string } | null> {
  // Chercher avec les deux noms de champ possibles (nouveau: member_uid, ancien: user_id)
  const [snapNew, snapLegacy] = await Promise.all([
    getDocs(
      query(collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('member_uid', '==', memberUid),
        where('period_month', '==', month))
    ),
    getDocs(
      query(collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('user_id', '==', memberUid),
        where('month', '==', month))
    ),
  ]);

  const doc = snapNew.docs[0] ?? snapLegacy.docs[0];
  if (!doc) return null;
  return { status: doc.data().status, id: doc.id };
}

// Alias utilisé dans les écrans
export { checkAlreadyPaid as getMemberContributionStatus };

// ─── submitContribution ───────────────────────────────────────────────────────

export async function submitContribution(data: ContributionSubmission): Promise<string> {
  // Idempotence
  const existing = await checkAlreadyPaid(data.groupId, data.memberUid, data.periodMonth);
  if (existing?.status === 'paid') throw new Error('ALREADY_PAID');
  if (existing?.status === 'pending_approval') throw new Error('ALREADY_PENDING');

  // Créer la contribution
  const ref = await addDoc(collection(db, 'contributions'), {
    group_id: data.groupId,
    member_uid: data.memberUid,
    member_name: data.memberName,
    period_month: data.periodMonth,
    amount_due: data.amountDue,
    currency: data.currency,
    status: 'pending_approval',
    capture_image_url: data.captureImageUrl ?? null,      // null si R2 indisponible
    capture_image_path: data.captureImagePath ?? null,    // null si R2 indisponible
    capture_uploaded_at: data.captureImageUrl ? serverTimestamp() : null,
    member_note: data.memberNote ?? null,
    gemini_analysis: data.geminiAnalysis ?? null,
    is_late: false,
    penalty_amount: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Notifier la trésorière
  const groupDoc = await getDoc(doc(db, 'groups', data.groupId));
  if (groupDoc.exists()) {
    const gd = groupDoc.data();
    await addDoc(collection(db, 'notifications'), {
      recipient_uid: gd.treasurer_uid,
      type: 'new_submission',
      title: 'Nouvelle capture à valider',
      body: `${data.memberName} a soumis une capture pour ${data.periodMonth}`,
      data: { contribution_id: ref.id, group_id: data.groupId, month: data.periodMonth },
      is_read: false,
      created_at: serverTimestamp(),
    });
  }

  return ref.id;
}

// ─── approveContribution ──────────────────────────────────────────────────────

export async function approveContribution(approval: ContributionApproval): Promise<void> {
  const contribRef = doc(db, 'contributions', approval.contributionId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(contribRef);
    if (!snap.exists()) throw new Error('CONTRIBUTION_NOT_FOUND');
    const cd = snap.data();

    tx.update(contribRef, {
      status: 'paid',
      amount_paid: approval.amountPaid,
      approved_by: approval.approvedBy,
      approved_at: serverTimestamp(),
      treasurer_notes: approval.treasurerNotes ?? null,
      updated_at: serverTimestamp(),
    });

    // Incrémenter le solde du groupe
    const groupRef = doc(db, 'groups', cd.group_id);
    const groupSnap = await tx.get(groupRef);
    if (groupSnap.exists()) {
      const current = groupSnap.data().collected_amount || 0;
      tx.update(groupRef, { collected_amount: current + approval.amountPaid, updated_at: serverTimestamp() });
    }
  });

  // Notifier le membre
  const snap = await getDoc(contribRef);
  if (snap.exists()) {
    const cd = snap.data();
    await addDoc(collection(db, 'notifications'), {
      recipient_uid: cd.member_uid,
      type: 'payment_confirmed',
      title: '✅ Contribution validée !',
      body: `Votre paiement de ${approval.amountPaid.toLocaleString('fr-FR')} ${cd.currency} a été approuvé.`,
      data: { contribution_id: approval.contributionId, group_id: cd.group_id, month: cd.period_month },
      is_read: false,
      created_at: serverTimestamp(),
    });
  }
}

// ─── rejectContribution ───────────────────────────────────────────────────────

export async function rejectContribution(contributionId: string, reason: string, rejectedBy: string): Promise<void> {
  const contribRef = doc(db, 'contributions', contributionId);
  await updateDoc(contribRef, {
    status: 'rejected',
    rejection_reason: reason,
    rejected_by: rejectedBy,
    updated_at: serverTimestamp(),
  });

  const snap = await getDoc(contribRef);
  if (snap.exists()) {
    const cd = snap.data();
    await addDoc(collection(db, 'notifications'), {
      recipient_uid: cd.member_uid,
      type: 'payment_rejected',
      title: '❌ Contribution rejetée',
      body: `Raison : ${reason}`,
      data: { contribution_id: contributionId, group_id: cd.group_id, month: cd.period_month },
      is_read: false,
      created_at: serverTimestamp(),
    });
  }
}

// ─── getPendingApprovals (temps réel) ─────────────────────────────────────────

export function getPendingApprovals(groupId: string, callback: (items: any[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('status', '==', 'pending_approval'),
      orderBy('created_at', 'asc')),
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

// ─── getContributionHistory ───────────────────────────────────────────────────

export async function getContributionHistory(
  groupId: string,
  filters: { month?: string; memberUid?: string; status?: string; pageSize?: number; lastDoc?: any }
): Promise<{ items: any[]; lastDoc: any }> {
  const constraints: any[] = [where('group_id', '==', groupId)];
  if (filters.month) constraints.push(where('period_month', '==', filters.month));
  if (filters.memberUid) constraints.push(where('member_uid', '==', filters.memberUid));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  constraints.push(orderBy('created_at', 'desc'));
  constraints.push(limit(filters.pageSize ?? 20));
  if (filters.lastDoc) constraints.push(startAfter(filters.lastDoc));

  const snap = await getDocs(query(collection(db, 'contributions'), ...constraints));
  return {
    items: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}

// ─── getMemberHistory ─────────────────────────────────────────────────────────

export async function getMemberHistory(memberUid: string, year: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'contributions'),
      where('member_uid', '==', memberUid),
      orderBy('period_month', 'desc'))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((c: any) => c.period_month?.startsWith(year));
}

// ─── uploadCaptureImage ───────────────────────────────────────────────────────

export async function uploadCaptureImage(
  localUri: string, groupId: string, memberUid: string, month: string
): Promise<string> {
  const { uploadFile } = await import('./storageService');
  const fileName = `contributions/${groupId}/${memberUid}/${month}/${Date.now()}.jpg`;
  const result = await uploadFile(localUri, 'receipts', fileName);
  return result.url;
}

// ─── generateReceiptData ──────────────────────────────────────────────────────

export async function generateReceiptData(contributionId: string): Promise<any> {
  const snap = await getDoc(doc(db, 'contributions', contributionId));
  if (!snap.exists()) throw new Error('CONTRIBUTION_NOT_FOUND');
  const cd = snap.data();

  const [userSnap, groupSnap] = await Promise.all([
    getDoc(doc(db, 'users', cd.member_uid)),
    getDoc(doc(db, 'groups', cd.group_id)),
  ]);

  return {
    contribution: { id: snap.id, ...cd },
    member: userSnap.exists() ? userSnap.data() : null,
    group: groupSnap.exists() ? groupSnap.data() : null,
  };
}

// ─── Helpers legacy (compatibilité dashboards) ────────────────────────────────

export async function getContributionsForMonth(groupId: string): Promise<any[]> {
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const snap = await getDocs(
    query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('period_month', '==', month))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getRecentPaymentsForMember(memberUid: string, count = 3): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'contributions'),
      where('member_uid', '==', memberUid),
      where('status', '==', 'paid'),
      orderBy('approved_at', 'desc'),
      limit(count))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getRecentPaymentsForGroup(groupId: string, count = 5): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'contributions'),
      where('group_id', '==', groupId),
      where('status', '==', 'paid'),
      orderBy('approved_at', 'desc'),
      limit(count))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

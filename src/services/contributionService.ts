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
import { auth, db } from '../config/firebase';

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

function normalizeContributionStatus(status?: string | null): string {
  const normalized = (status ?? '').toString().trim().toLowerCase();

  if (['paid', 'paye', 'paye_partiel', 'payé', 'approuve', 'approuvée', 'approved'].includes(normalized)) {
    return 'paid';
  }

  if (['pending_approval', 'pending', 'en_attente', 'en attente', 'submitted'].includes(normalized)) {
    return 'pending_approval';
  }

  if (['rejected', 'rejete', 'rejetee', 'échoué', 'echec', 'failed'].includes(normalized)) {
    return 'rejected';
  }

  return normalized;
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

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapContributionStatus(rawStatus?: string | null, isLate?: boolean): ContributionFilter {
  const normalized = (rawStatus ?? '').toString().trim().toLowerCase();

  if (isLate || ['late', 'en_retard', 'en retard'].includes(normalized)) {
    return 'EN_RETARD';
  }
  if (['paid', 'paye', 'payé', 'approved', 'approuve', 'approuvé', 'paye_partiel'].includes(normalized)) {
    return 'PAYE';
  }
  if (['pending_approval', 'pending', 'en_attente', 'en attente', 'submitted'].includes(normalized)) {
    return 'EN_ATTENTE';
  }
  if (['rejected', 'rejete', 'rejetee', 'échec', 'echec', 'failed', 'failure'].includes(normalized)) {
    return 'ECHEC';
  }
  return 'EN_ATTENTE';
}

function normalizeOperator(value?: string | null): ContributionItem['operator'] {
  const normalized = (value ?? '').toString().trim().toLowerCase();
  if (['airtel', 'orange', 'mpesa', 'mtn'].includes(normalized)) {
    return normalized as ContributionItem['operator'];
  }
  return undefined;
}

export async function fetchGroupContributions(
  groupId: string,
  month: string,
  filter: ContributionFilter,
  page: number,
  pageSize = 20,
  options?: any
): Promise<{ items: ContributionItem[], summary: ContributionSummary, hasMore: boolean, total: number, page: number }> {
  const safePage = Math.max(1, page || 1);
  const safePageSize = Math.max(1, pageSize || 20);
  const selectedMemberId = options?.memberId ? String(options.memberId) : null;
  const sort = (options?.sort ?? 'date_desc') as ContributionSort;

  const [groupSnap, membersSnap, currentSnap, legacySnap] = await Promise.all([
    getDoc(doc(db, 'groups', groupId)),
    getDocs(collection(db, 'groups', groupId, 'members')).catch(() => ({ docs: [] as any[] })),
    getDocs(
      query(
        collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('period_month', '==', month),
      )
    ).catch(() => ({ docs: [] as any[] })),
    getDocs(
      query(
        collection(db, 'contributions'),
        where('group_id', '==', groupId),
        where('month', '==', month),
      )
    ).catch(() => ({ docs: [] as any[] })),
  ]);

  const membersById = new Map<string, any>();
  for (const memberDoc of membersSnap.docs) {
    const memberData = memberDoc.data();
    const memberUid = memberData.uid ?? memberDoc.id;
    membersById.set(memberUid, memberData);
  }

  const docsById = new Map<string, any>();
  for (const snap of [...currentSnap.docs, ...legacySnap.docs]) {
    docsById.set(snap.id, snap);
  }

  let items = Array.from(docsById.values()).map((snap) => {
    const raw = snap.data();
    const memberId = raw.member_uid ?? raw.memberUid ?? raw.user_id ?? raw.userId ?? '';
    const memberData = membersById.get(memberId) ?? {};
    const amountPaid = Number(raw.amount_paid ?? raw.amountPaid ?? 0);
    const amountDue = Number(raw.amount_due ?? raw.amountDue ?? raw.amount ?? 0);
    const amount = amountPaid > 0 ? amountPaid : amountDue;
    const paidAtValue = raw.approved_at ?? raw.approvedAt ?? raw.paid_at ?? raw.paidAt ?? raw.created_at ?? raw.createdAt ?? null;
    const detectedOperator =
      raw.operator ??
      raw.payment_operator ??
      raw.user_operator ??
      raw.gemini_analysis?.operator ??
      memberData.operator;

    return {
      id: snap.id,
      memberId,
      memberName:
        raw.member_name ??
        raw.memberName ??
        memberData.full_name ??
        memberData.name ??
        'Membre inconnu',
      memberAvatar:
        raw.member_avatar ??
        raw.memberAvatar ??
        memberData.profile_photo_url ??
        memberData.photo_url ??
        undefined,
      memberPhone: raw.member_phone ?? raw.memberPhone ?? memberData.phone ?? undefined,
      amount,
      currency: (raw.currency ?? groupSnap.data()?.currency ?? 'CDF') as 'CDF' | 'USD',
      operator: normalizeOperator(detectedOperator),
      paidAt: paidAtValue ? new Date(toMillis(paidAtValue)).toISOString() : undefined,
      status: mapContributionStatus(raw.status, Boolean(raw.is_late ?? raw.isLate)),
      txReference:
        raw.transaction_ref ??
        raw.tx_reference ??
        raw.txReference ??
        raw.gemini_analysis?.transaction_ref ??
        snap.id,
      errorMessage: raw.rejection_reason ?? raw.error_message ?? raw.errorMessage ?? undefined,
    } satisfies ContributionItem;
  });

  const summary = items.reduce<ContributionSummary>((acc, item) => {
    if (item.status === 'PAYE') {
      acc.paidCount += 1;
      acc.collectedAmount += Number(item.amount || 0);
    } else if (item.status === 'EN_ATTENTE') {
      acc.pendingCount += 1;
    } else if (item.status === 'EN_RETARD') {
      acc.lateCount += 1;
    } else if (item.status === 'ECHEC') {
      acc.failedCount += 1;
    }
    return acc;
  }, {
    collectedAmount: 0,
    expectedAmount: 0,
    totalMembers: 0,
    paidCount: 0,
    pendingCount: 0,
    lateCount: 0,
    failedCount: 0,
  });

  const activeMembers = membersSnap.docs.filter((memberDoc) => {
    const statusValue = memberDoc.data()?.status ?? 'active';
    return statusValue !== 'removed';
  });
  const groupData = groupSnap.exists() ? groupSnap.data() : {};
  const contributionAmount = Number(
    groupData?.contribution_amount ??
    groupData?.monthly_amount ??
    groupData?.amount ??
    0
  );
  summary.totalMembers = activeMembers.length || Number(groupData?.member_count ?? 0);
  summary.expectedAmount = contributionAmount * summary.totalMembers;

  if (selectedMemberId) {
    items = items.filter((item) => item.memberId === selectedMemberId);
  }

  if (filter !== 'all') {
    items = items.filter((item) => item.status === filter);
  }

  items.sort((a, b) => {
    switch (sort) {
      case 'date_asc':
        return toMillis(a.paidAt) - toMillis(b.paidAt);
      case 'name_asc':
        return a.memberName.localeCompare(b.memberName, 'fr', { sensitivity: 'base' });
      case 'amount_desc':
        return Number(b.amount) - Number(a.amount);
      case 'date_desc':
      default:
        return toMillis(b.paidAt) - toMillis(a.paidAt);
    }
  });

  const total = items.length;
  const startIndex = (safePage - 1) * safePageSize;
  const pagedItems = items.slice(startIndex, startIndex + safePageSize);

  return {
    items: pagedItems,
    summary,
    hasMore: startIndex + safePageSize < total,
    total,
    page: safePage,
  };
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
  return { status: normalizeContributionStatus(doc.data().status), id: doc.id };
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
  const snapBeforeUpdate = await getDoc(contribRef);
  if (!snapBeforeUpdate.exists()) throw new Error('CONTRIBUTION_NOT_FOUND');

  const contributionData = snapBeforeUpdate.data();
  const groupId = contributionData.group_id ?? contributionData.groupId ?? '';

  await updateDoc(contribRef, {
    status: 'paid',
    amount_paid: approval.amountPaid,
    approved_by: approval.approvedBy,
    approved_at: serverTimestamp(),
    treasurer_notes: approval.treasurerNotes ?? null,
    updated_at: serverTimestamp(),
  });

  if (groupId && auth.currentUser?.uid) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists() && groupSnap.data().admin_uid === auth.currentUser.uid) {
      const current = groupSnap.data().collected_amount || 0;
      await updateDoc(groupRef, {
        collected_amount: current + approval.amountPaid,
        updated_at: serverTimestamp(),
      });
    }
  }

  const snap = await getDoc(contribRef);
  if (snap.exists()) {
    const cd = snap.data();
    const memberUid = cd.member_uid ?? cd.memberUid ?? cd.user_id ?? cd.userId ?? '';
    const notifiedGroupId = cd.group_id ?? cd.groupId ?? '';
    const periodMonth = cd.period_month ?? cd.periodMonth ?? cd.month ?? '';

    if (memberUid) {
      await addDoc(collection(db, 'notifications'), {
        recipient_uid: memberUid,
        type: 'payment_confirmed',
        title: 'Contribution validee',
        body: `Votre paiement de ${approval.amountPaid.toLocaleString('fr-FR')} ${cd.currency} a ete approuve.`,
        data: { contribution_id: approval.contributionId, group_id: notifiedGroupId, month: periodMonth },
        is_read: false,
        created_at: serverTimestamp(),
      });
    }
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
    const rejectRecipient = cd.member_uid ?? cd.memberUid ?? cd.user_id ?? cd.userId ?? '';
    if (!rejectRecipient) return;
    await addDoc(collection(db, 'notifications'), {
      recipient_uid: rejectRecipient,
      type: 'payment_rejected',
      title: '❌ Contribution rejetée',
      body: `Raison : ${reason}`,
      data: { contribution_id: contributionId, group_id: cd.group_id ?? cd.groupId ?? '', month: cd.period_month ?? cd.periodMonth ?? cd.month ?? '' },
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

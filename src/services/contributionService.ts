/**
 * contributionService.ts
 * Couche API pour les contributions / paiements — Module 03
 */
import { api } from './api';
import type { PaymentStatus } from '../components/common/StatusBadge';

// ─── Types ───────────────────────────────────────────────────

export type ContributionFilter = 'all' | PaymentStatus;

export interface ContributionItem {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  amount: number;
  currency: 'CDF' | 'USD';
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn';
  paidAt: string;       // ISO 8601
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

// ─── Types additionnels SCR-009 / SCR-010 ────────────────────

export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

export interface CurrentMonthStatus {
  alreadyPaid: boolean;
  amount?: number;
  paidAt?: string;   // ISO
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

// ─── API calls ───────────────────────────────────────────────

export async function fetchGroupContributions(
  groupId: string,
  month: string,
  filter: ContributionFilter = 'all',
  page  = 1,
  limit = 20,
): Promise<ContributionsPage> {
  const params: Record<string, string | number> = { month, page, limit };
  if (filter !== 'all') params.status = filter;
  const { data } = await api.get(`/groups/${groupId}/contributions`, { params });
  return data;
}

/** SCR-009 — Contributions PAYÉ uniquement (vue trésorière) */
export async function fetchPaidContributions(
  groupId: string,
  month: string,
  page  = 1,
  limit = 20,
): Promise<ContributionsPage> {
  const { data } = await api.get(`/groups/${groupId}/contributions`, {
    params: { month, status: 'PAYE', page, limit },
  });
  return data;
}

/** SCR-009 — Export Excel */
export async function exportContributions(
  groupId: string,
  month: string,
  format: 'xlsx' | 'csv' = 'xlsx',
): Promise<ExportUrlResponse> {
  const { data } = await api.get(`/groups/${groupId}/contributions/export`, {
    params: { month, format },
  });
  return data;
}

/** SCR-010 — Vérifie si le membre a déjà payé ce mois */
export async function checkCurrentMonthStatus(
  groupId: string,
  memberId: string,
): Promise<CurrentMonthStatus> {
  const { data } = await api.get(
    `/contributions/${groupId}/current-month/${memberId}`,
  );
  return data;
}

/** SCR-010 — Initier un paiement Mobile Money */
export async function initiatePayment(
  req: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  const { data } = await api.post('/contributions/initiate', req);
  return data;
}

/** SCR-010 — Polling statut transaction */
export async function pollTransactionStatus(
  txId: string,
): Promise<TransactionStatusResponse> {
  const { data } = await api.get(`/contributions/transaction/${txId}/status`);
  return data;
}

export async function sendMemberReminder(memberId: string): Promise<void> {
  await api.post(`/notifications/remind/${memberId}`);
}

export async function sendGroupRemindAll(groupId: string): Promise<void> {
  await api.post(`/groups/${groupId}/notify/remind-all`);
}

// ─── Types SCR-011 / SCR-012 ─────────────────────────────────

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
  paidAt:         string;   // ISO 8601
}

export interface PdfUrlResponse {
  downloadUrl: string;        // URL S3 signée, valide 24h
  expiresAt:   string;        // ISO 8601
}

/** SCR-011 / SCR-012 — Détails du reçu d'une transaction */
export async function fetchReceiptDetail(txId: string): Promise<ReceiptDetail> {
  const { data } = await api.get(`/contributions/${txId}/receipt`);
  return data;
}

/** SCR-012 — URL du PDF du reçu */
export async function fetchReceiptPdfUrl(txId: string): Promise<PdfUrlResponse> {
  const { data } = await api.get(`/contributions/${txId}/receipt/pdf`);
  return data;
}

/**
 * excelReportService.ts
 * Génère un fichier .xlsx multi-feuilles complet depuis Firestore.
 * Utilise SheetJS (xlsx) côté client — aucun backend requis.
 */
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { safeDate } from '../utils/formatDate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPeriod(period: string): string {
  if (/^\d{4}-Q\d$/.test(period)) {
    const [year, q] = period.split('-Q');
    return `Trimestre ${q} — ${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const d = new Date(`${period}-01`);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  return period;
}

function fmtDateStr(value: any): string {
  const d = safeDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtAmount(n: number, currency: string): string {
  return `${n.toLocaleString('fr-FR')} ${currency}`;
}

function toStatusLabel(status: string): string {
  switch ((status ?? '').toUpperCase()) {
    case 'PAYE':
    case 'PAID':
    case 'APPROVED':         return 'Payé ✓';
    case 'EN_ATTENTE':
    case 'PENDING':          return 'En attente';
    case 'EN_RETARD':
    case 'LATE':             return 'En retard ⚠';
    case 'REJECTED':         return 'Rejeté ✗';
    case 'PENDING_APPROVAL': return 'En vérification';
    case 'NOT_SUBMITTED':    return 'Non soumis';
    default:                 return status ?? '—';
  }
}

function isPaid(status: string): boolean {
  return ['PAYE', 'PAID', 'APPROVED', 'paid', 'approved'].includes(status ?? '');
}

function autoColWidths(data: any[][]): XLSX.ColInfo[] {
  if (!data.length) return [];
  return data[0].map((_, colIdx) => {
    const maxLen = data.reduce((max, row) => {
      const cell = row[colIdx];
      return Math.max(max, cell != null ? String(cell).length : 0);
    }, 10);
    return { wch: Math.min(maxLen + 2, 50) };
  });
}

// ─── Récupération des données ──────────────────────────────────────────────────

async function fetchContributionsForMonths(groupId: string, months: string[]): Promise<any[]> {
  // Single bulk query for the whole group — filter by month client-side.
  // This costs 1 read per contribution doc (not N×2 per month), making yearly
  // reports ~24× cheaper than the per-month loop approach.
  const snap = await getDocs(query(collection(db, 'contributions'), where('group_id', '==', groupId)));
  const monthSet = new Set(months);
  const results: any[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const docMonth = data.period_month ?? data.month ?? '';
    if (monthSet.has(docMonth)) results.push({ id: d.id, ...data });
  }
  return results;
}

async function fetchGroupMembers(groupId: string): Promise<any[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

async function fetchGroupData(groupId: string): Promise<any | null> {
  const docSnap = await getDoc(doc(db, 'groups', groupId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

async function fetchUserProfiles(uids: string[]): Promise<Record<string, any>> {
  const map: Record<string, any> = {};
  await Promise.all(uids.map(async uid => {
    const d = await getDoc(doc(db, 'users', uid));
    if (d.exists()) map[uid] = d.data();
  }));
  return map;
}

// ─── Feuille 1 : Résumé ───────────────────────────────────────────────────────

function buildResumeSheet(
  group: any, period: string, contributions: any[], members: any[]
): XLSX.WorkSheet {
  const currency = group?.currency ?? 'CDF';
  const paidContribs = contributions.filter(c => isPaid(c.status));
  const unpaidCount = members.length - paidContribs.length;
  const totalExpected = members.length * (group?.contribution_amount ?? 0);
  const totalCollected = paidContribs.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const totalPenalties = contributions.reduce((s, c) => s + Number(c.penalty_amount || 0), 0);
  const participationRate = members.length > 0 ? Math.round((paidContribs.length / members.length) * 100) : 0;
  const generatedAt = new Date().toLocaleString('fr-FR');

  const rows: any[][] = [
    ['RAPPORT DE COTISATIONS — ContribApp RDC', ''],
    ['', ''],
    ['Informations du groupe', ''],
    ['Nom du groupe',            group?.name ?? '—'],
    ['Période du rapport',       fmtPeriod(period)],
    ['Date de génération',       generatedAt],
    ['Trésorier(e)',             group?.treasurer_name ?? '—'],
    ['Téléphone trésorier(e)',   group?.treasurer_phone ?? '—'],
    ['Opérateur mobile',         (group?.treasurer_operator ?? '—').toUpperCase()],
    ['Montant cotisation/membre', fmtAmount(group?.contribution_amount ?? 0, currency)],
    ['Jour d\'échéance',         `Le ${group?.payment_deadline_day ?? 25} de chaque mois`],
    ['Code d\'invitation',       group?.invite_code ?? '—'],
    ['', ''],
    ['INDICATEURS CLÉS', ''],
    ['Indicateur',               'Valeur'],
    ['Nombre total de membres',  members.length],
    ['Membres ayant payé',       paidContribs.length],
    ['Membres n\'ayant pas payé', unpaidCount],
    ['Taux de participation',    `${participationRate} %`],
    ['Montant attendu (total)',   fmtAmount(totalExpected, currency)],
    ['Montant collecté',         fmtAmount(totalCollected, currency)],
    ['Montant manquant',         fmtAmount(Math.max(0, totalExpected - totalCollected), currency)],
    ['Total pénalités de retard', fmtAmount(totalPenalties, currency)],
    ['', ''],
    ['RÉPARTITION DES STATUTS', ''],
    ['Statut',                   'Nombre de membres'],
    ['Payé',                     paidContribs.length],
    ['En attente / retard',      contributions.filter(c =>
      ['EN_ATTENTE', 'PENDING', 'EN_RETARD', 'LATE', 'PENDING_APPROVAL'].includes((c.status ?? '').toUpperCase())).length],
    ['Non soumis',               contributions.filter(c =>
      ['NOT_SUBMITTED', 'not_submitted'].includes(c.status ?? '')).length],
    ['Non enregistré',           Math.max(0, unpaidCount -
      contributions.filter(c => !isPaid(c.status)).length)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 38 }, { wch: 30 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 13, c: 0 }, e: { r: 13, c: 1 } },
    { s: { r: 23, c: 0 }, e: { r: 23, c: 1 } },
  ];
  return ws;
}

// ─── Feuille 2 : Paiements reçus ─────────────────────────────────────────────

function buildPaiementsSheet(
  contributions: any[], userMap: Record<string, any>, currency: string
): XLSX.WorkSheet {
  const paid = contributions
    .filter(c => isPaid(c.status))
    .sort((a, b) => {
      const ta = safeDate(a.paid_at || a.approved_at)?.getTime() ?? 0;
      const tb = safeDate(b.paid_at || b.approved_at)?.getTime() ?? 0;
      return tb - ta;
    });

  const header = [
    'N°', 'Nom du membre', 'Téléphone', 'Montant payé', 'Pénalité incluse',
    'Total versé', 'Date de paiement', 'Date de validation',
    'Opérateur mobile', 'Référence transaction', 'Mois de cotisation', 'Statut',
  ];

  const dataRows: any[][] = paid.map((c, i) => {
    const uid = c.member_uid ?? c.user_id ?? '';
    const user = userMap[uid] ?? {};
    const amount = Number(c.amount_paid || c.amount || 0);
    const penalty = Number(c.penalty_amount || 0);
    return [
      i + 1,
      user.full_name ?? c.full_name ?? c.member_name ?? '—',
      user.phone ?? c.phone ?? '—',
      fmtAmount(amount, currency),
      penalty > 0 ? fmtAmount(penalty, currency) : '—',
      fmtAmount(amount + penalty, currency),
      fmtDateStr(c.paid_at || c.submitted_at),
      fmtDateStr(c.approved_at),
      (c.operator ?? user.operator ?? '—').toUpperCase(),
      c.tx_reference ?? c.transaction_ref ?? c.reference ?? '—',
      c.period_month ?? c.month ?? '—',
      toStatusLabel(c.status),
    ];
  });

  if (dataRows.length === 0) {
    dataRows.push(['Aucun paiement enregistré pour cette période.', ...Array(11).fill('')]);
  }

  const totalAmount = paid.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const totalPenalty = paid.reduce((s, c) => s + Number(c.penalty_amount || 0), 0);
  const totalRow: any[] = [
    `TOTAL (${paid.length} paiement${paid.length !== 1 ? 's' : ''})`,
    '', '',
    fmtAmount(totalAmount, currency),
    fmtAmount(totalPenalty, currency),
    fmtAmount(totalAmount + totalPenalty, currency),
    '', '', '', '', '', '',
  ];

  const allRows = [header, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = autoColWidths(allRows);
  return ws;
}

// ─── Feuille 3 : Membres impayés ──────────────────────────────────────────────

function buildImpayesSheet(
  contributions: any[], members: any[], userMap: Record<string, any>,
  group: any, period: string
): XLSX.WorkSheet {
  const currency = group?.currency ?? 'CDF';
  const baseAmount = group?.contribution_amount ?? 0;
  const penaltyRate = (group?.late_penalty_percent ?? 0) / 100;
  const penaltyPerMember = Math.round(baseAmount * penaltyRate);
  const dueDay = group?.payment_deadline_day ?? 25;

  // Calcul du retard
  let dueDate: Date;
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    dueDate = new Date(Number(match[1]), Number(match[2]) - 1, dueDay);
  } else {
    dueDate = new Date(new Date().getFullYear(), new Date().getMonth(), dueDay);
  }
  const today = new Date();
  const daysLate = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));

  const paidUids = new Set(
    contributions.filter(c => isPaid(c.status)).map(c => c.member_uid ?? c.user_id)
  );
  const unpaidMembers = members.filter(m => !paidUids.has(m.uid ?? m.id));

  const header = [
    'N°', 'Nom du membre', 'Téléphone', 'Opérateur',
    'Montant dû', 'Pénalité de retard', 'Total à payer',
    'Jours de retard', 'Statut actuel', 'Date d\'adhésion',
  ];

  const dataRows: any[][] = unpaidMembers.map((m, i) => {
    const uid = m.uid ?? m.id;
    const user = userMap[uid] ?? m;
    const contrib = contributions.find(c => (c.member_uid ?? c.user_id) === uid);
    const currentStatus = contrib ? toStatusLabel(contrib.status) : 'Non soumis';
    const appliedPenalty = daysLate > 0 && penaltyPerMember > 0 ? penaltyPerMember : 0;
    return [
      i + 1,
      user.full_name ?? m.full_name ?? '—',
      user.phone ?? m.phone ?? '—',
      (user.operator ?? m.operator ?? '—').toUpperCase(),
      fmtAmount(baseAmount, currency),
      appliedPenalty > 0 ? fmtAmount(appliedPenalty, currency) : '—',
      fmtAmount(baseAmount + appliedPenalty, currency),
      daysLate > 0 ? `${daysLate} j` : 'Non échu',
      currentStatus,
      fmtDateStr(m.joined_at),
    ];
  });

  if (dataRows.length === 0) {
    dataRows.push(['✓ Tous les membres ont payé pour cette période.', ...Array(9).fill('')]);
  }

  const totalDu = unpaidMembers.length * baseAmount;
  const totalPenaltyDu = daysLate > 0 ? unpaidMembers.length * penaltyPerMember : 0;
  const totalRow: any[] = [
    `TOTAL (${unpaidMembers.length} impayé${unpaidMembers.length !== 1 ? 's' : ''})`,
    '', '', '',
    fmtAmount(totalDu, currency),
    totalPenaltyDu > 0 ? fmtAmount(totalPenaltyDu, currency) : '—',
    fmtAmount(totalDu + totalPenaltyDu, currency),
    '', '', '',
  ];

  const allRows = [header, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = autoColWidths(allRows);
  return ws;
}

// ─── Export principal ─────────────────────────────────────────────────────────

export interface ExcelReportOptions {
  groupId: string;
  period: string;       // "2025-05" | "2025-Q2" | "2025"
  reportType?: 'monthly' | 'quarterly' | 'yearly';
}

export async function generateGroupExcelReport(opts: ExcelReportOptions): Promise<void> {
  const { groupId, period } = opts;

  // 1. Déterminer les mois couverts
  let months: string[];
  if (/^\d{4}-Q\d$/.test(period)) {
    const [year, q] = period.split('-Q');
    const start = (Number(q) - 1) * 3 + 1;
    months = [start, start + 1, start + 2].map(m => `${year}-${String(m).padStart(2, '0')}`);
  } else if (/^\d{4}$/.test(period)) {
    months = Array.from({ length: 12 }, (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`);
  } else {
    months = [period];
  }

  // 2. Charger toutes les données en parallèle
  const [group, members, contributions] = await Promise.all([
    fetchGroupData(groupId),
    fetchGroupMembers(groupId),
    fetchContributionsForMonths(groupId, months),
  ]);

  const allUids = [...new Set([
    ...members.map((m: any) => m.uid ?? m.id),
    ...contributions.map((c: any) => c.member_uid ?? c.user_id),
  ].filter(Boolean))];
  const userMap = await fetchUserProfiles(allUids);

  const currency = group?.currency ?? 'CDF';

  // 3. Construire le workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildResumeSheet(group, period, contributions, members), 'Résumé');
  XLSX.utils.book_append_sheet(wb, buildPaiementsSheet(contributions, userMap, currency), 'Paiements reçus');
  XLSX.utils.book_append_sheet(wb, buildImpayesSheet(contributions, members, userMap, group, period), 'Membres impayés');

  // 4. Écrire en base64 et sauvegarder
  const wbOut: string = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const safePeriod = fmtPeriod(period).replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `ContribApp_${group?.name ?? 'Groupe'}_${safePeriod}.xlsx`
    .replace(/\s+/g, '_');
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, wbOut, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 5. Ouvrir le panneau de partage natif
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Le partage de fichiers n\'est pas disponible sur cet appareil.');

  await Sharing.shareAsync(filePath, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Rapport ${fmtPeriod(period)} — ${group?.name ?? ''}`,
    UTI: 'com.microsoft.excel.xlsx',
  });
}

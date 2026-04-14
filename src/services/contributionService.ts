import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import * as Print from 'expo-print';
import { db, auth } from '../config/firebase';

import { AGGREGATOR_CONFIG } from '../config/aggregator';
import { uploadReceipt } from './storageService';

export interface InitiatePaymentData {
  group_id: string;
  member_uid: string;
  member_name: string;
  amount: number;
  currency: 'CDF' | 'USD';
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn';
  payer_phone: string;
  treasurer_phone: string;
  period_month: string;
  penalty_amount?: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'late';

export interface AggregatorResponse {
  code: string;
  message: string;
  orderNumber: string;
}

export interface Contribution {
  id: string;
  group_id: string;
  member_uid: string;
  member_name: string;
  period_month: string;
  amount_due: number;
  amount_paid?: number;
  status: PaymentStatus;
  payment_method?: string;
  transaction_ref?: string;
  aggregator_ref?: string;
  paid_at?: string;
  is_late: boolean;
  penalty_amount: number;
  receipt_url?: string;
}

export async function callFlexPay(data: any): Promise<AggregatorResponse> {
  const isSandbox = AGGREGATOR_CONFIG.isSandbox;
  const baseUrl = isSandbox ? AGGREGATOR_CONFIG.flexpay.sandboxUrl : AGGREGATOR_CONFIG.flexpay.baseUrl;
  const token = AGGREGATOR_CONFIG.flexpay.token;
  const merchantCode = AGGREGATOR_CONFIG.flexpay.merchantCode;

  const body = {
    merchant: merchantCode,
    type: "1",
    phone: data.payer_phone,
    reference: data.reference,
    amount: data.amount.toString(),
    currency: data.currency,
    callbackUrl: "https://contributapp-rdc.com/webhooks/flexpay"
  };

  try {
    const res = await fetch(`${baseUrl}/paymentService`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('API_ERROR');
    return await res.json();
  } catch (error) {
    console.error('Call FlexPay error: ', error);
    // Simuler le succès en dev/sandbox si réseau instable
    if (isSandbox) return { code: "0", message: "Success simulated", orderNumber: "test_tx_" + Date.now() };
    throw error;
  }
}

export async function checkPaymentStatus(transactionId: string): Promise<{status: PaymentStatus, transaction_ref: string}> {
    // Si sandbox etc, retourner status
    if (AGGREGATOR_CONFIG.isSandbox) {
        return { status: 'paid', transaction_ref: transactionId };
    }
    
    const baseUrl = AGGREGATOR_CONFIG.flexpay.baseUrl;
    const token = AGGREGATOR_CONFIG.flexpay.token;
    
    try {
        const res = await fetch(`${baseUrl}/checkPayment/${transactionId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        if (!res.ok) throw new Error('API_ERROR');
        const flexData = await res.json();
        
        // Convert flexplay status to our status
        let status: PaymentStatus = 'pending';
        if (flexData.status === 'SUCCESS') status = 'paid';
        if (flexData.status === 'FAILED') status = 'failed';
        
        return { status, transaction_ref: flexData.reference || transactionId };
    } catch(err) {
        throw new Error('STATUS_CHECK_FAILED');
    }
}

export async function initiatePayment(data: InitiatePaymentData): Promise<{ transaction_id: string; status: string }> {
  const contributionId = 'contrib_' + Date.now();
  
  {
      const q = query(collection(db, 'contributions'), 
        where('group_id', '==', data.group_id),
        where('member_uid', '==', data.member_uid),
        where('period_month', '==', data.period_month),
        where('status', '==', 'paid')
      );
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error('ALREADY_PAID');
      
      await setDoc(doc(db, 'contributions', contributionId), {
          group_id: data.group_id,
          member_uid: data.member_uid,
          member_name: data.member_name,
          period_month: data.period_month,
          amount_due: data.amount,
          status: 'pending',
          payment_method: data.operator,
          created_at: serverTimestamp()
      });
  }

  // Call aggregator
  const flexReqData = { ...data, reference: contributionId };
  const aggRes = await callFlexPay(flexReqData);
  
  if (aggRes.code === "0") {
      await updateDoc(doc(db, 'contributions', contributionId), { aggregator_ref: aggRes.orderNumber });
      return { transaction_id: aggRes.orderNumber, status: 'pending' };
  } else {
      await updateDoc(doc(db, 'contributions', contributionId), { status: 'failed' });
      throw new Error('PAYMENT_INIT_FAILED');
  }
}

export async function getContributionHistory(groupId: string, filters: any): Promise<Contribution[]> {
   const q = query(collection(db, 'contributions'), where('group_id', '==', groupId) /* + autres filtres*/);
   const snap = await getDocs(q);
   return snap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Contribution));
}

export async function getCurrentMonthContribution(groupId: string, memberUid: string): Promise<Contribution | null> {
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    const q = query(collection(db, 'contributions'), 
        where('group_id', '==', groupId),
        where('member_uid', '==', memberUid),
        where('period_month', '==', currentMonth),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Contribution;
}

export async function generateReceiptPDF(contributionId: string): Promise<string> {
    const html = `
      <html>
        <body>
          <h1>Reçu de Contribution</h1>
          <p>ID: ${contributionId}</p>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    const publicUrl = await uploadReceipt(uri, contributionId);
    
    await updateDoc(doc(db, 'contributions', contributionId), { receipt_url: publicUrl });
    
    return publicUrl;
}

export type Currency = 'CDF' | 'USD';

export type PaymentOperator =
  | 'manual_capture'
  | 'airtel_money'
  | 'm_pesa'
  | 'orange_money'
  | 'mtn_momo';

export interface ContributionParams {
  groupId: string;
  memberUid: string;
  memberName: string;
  periodMonth: string;
  amount: {
    value: number;
    currency: Currency;
  };
  phoneNumber?: string;
  imageBase64?: string;
  imageUri?: string;
}

export interface ContributionResult {
  success: boolean;
  contributionId?: string;
  transactionRef?: string;
  strategyUsed: PaymentOperator;
  error?: string;
  rawAnalysis?: unknown;
}

export interface PaymentStrategy {
  name: PaymentOperator;
  initiatePayment(params: ContributionParams): Promise<ContributionResult>;
  verifyPayment?(transactionId: string): Promise<boolean>;
}

export interface StrategyConfig {
  enabled: boolean;
  apiBaseUrl?: string;
  [key: string]: unknown;
}

export interface RemotePaymentConfig {
  activeStrategy: PaymentOperator;
  strategies: Partial<Record<PaymentOperator, StrategyConfig>>;
}

export interface ContributionLogEntry {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  strategyUsed: PaymentOperator;
  status: 'success' | 'failure' | 'pending';
  contributionId?: string;
  error?: string;
}

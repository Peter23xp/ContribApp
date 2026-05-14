import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';

export class MobileMoneyStrategy implements PaymentStrategy {
  readonly name = 'm_pesa' as const;

  // TODO: Implement generic Mobile Money integration (M-Pesa / Orange Money / MTN MoMo)
  // Each operator will likely need its own strategy extending this class, or
  // this strategy can be parameterised via the StrategyConfig.apiBaseUrl from remote config.
  // Required env vars (from remote config strategies.m_pesa):
  //   apiBaseUrl   — operator API base URL
  //   apiKey       — operator API key
  //   merchantCode — merchant identifier
  async initiatePayment(_params: ContributionParams): Promise<ContributionResult> {
    throw new Error('NOT_IMPLEMENTED: MobileMoney API not yet wired');
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: MobileMoney verifyPayment not yet wired');
  }
}

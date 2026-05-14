import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';

export class AirtelMoneyStrategy implements PaymentStrategy {
  readonly name = 'airtel_money' as const;

  // TODO: Implement Airtel Money DRC API integration
  // Docs: https://developer.airtel.africa/apis
  // Required env vars (from remote config strategies.airtel_money):
  //   apiBaseUrl    — Airtel Money API base URL
  //   clientId      — OAuth2 client ID
  //   clientSecret  — OAuth2 client secret
  // Steps:
  //   1. POST /auth/oauth2/token to get access token
  //   2. POST /merchant/v2/payments/ with amount, currency, reference, subscriber.msisdn
  //   3. Poll GET /standard/v1/payments/{id} or handle callback webhook
  async initiatePayment(_params: ContributionParams): Promise<ContributionResult> {
    throw new Error('NOT_IMPLEMENTED: Airtel Money API not yet wired');
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: Airtel Money verifyPayment not yet wired');
  }
}

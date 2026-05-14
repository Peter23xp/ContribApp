import { PaymentStrategy, PaymentOperator } from './types';
import { getRemotePaymentConfig } from '../../config/remotePaymentConfig';
import { ManualCaptureStrategy } from './strategies/ManualCaptureStrategy';
import { AirtelMoneyStrategy } from './strategies/AirtelMoneyStrategy';
import { MobileMoneyStrategy } from './strategies/MobileMoneyStrategy';

function buildStrategy(name: PaymentOperator): PaymentStrategy {
  switch (name) {
    case 'manual_capture':
      return new ManualCaptureStrategy();
    case 'airtel_money':
      return new AirtelMoneyStrategy();
    case 'm_pesa':
    case 'orange_money':
    case 'mtn_momo':
      return new MobileMoneyStrategy();
    default:
      return new ManualCaptureStrategy();
  }
}

let cachedStrategy: PaymentStrategy | null = null;

export async function getActiveStrategy(): Promise<PaymentStrategy> {
  if (cachedStrategy) return cachedStrategy;

  const config = await getRemotePaymentConfig();
  const strategyConfig = config.strategies[config.activeStrategy];

  if (!strategyConfig?.enabled) {
    cachedStrategy = new ManualCaptureStrategy();
    return cachedStrategy;
  }

  cachedStrategy = buildStrategy(config.activeStrategy);
  return cachedStrategy;
}

export function resetStrategyCache(): void {
  cachedStrategy = null;
}

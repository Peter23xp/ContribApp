import { ContributionParams, ContributionResult } from './types';
import { getActiveStrategy } from './PaymentStrategyFactory';
import { appendLogEntry } from './contributionLog';
import { validatePhone } from '../../utils/validatePhone';

export async function contribute(params: ContributionParams): Promise<ContributionResult> {
  if (params.phoneNumber && !validatePhone(params.phoneNumber)) {
    return {
      success: false,
      strategyUsed: 'manual_capture',
      error: 'INVALID_PHONE_NUMBER',
    };
  }

  const strategy = await getActiveStrategy();

  await appendLogEntry({
    amount: params.amount.value,
    currency: params.amount.currency,
    strategyUsed: strategy.name,
    status: 'pending',
  });

  let result: ContributionResult;
  try {
    result = await strategy.initiatePayment(params);
  } catch (err: any) {
    result = {
      success: false,
      strategyUsed: strategy.name,
      error: err?.message ?? 'UNKNOWN_ERROR',
    };
  }

  await appendLogEntry({
    amount: params.amount.value,
    currency: params.amount.currency,
    strategyUsed: strategy.name,
    status: result.success ? 'success' : 'failure',
    contributionId: result.contributionId,
    error: result.error,
  });

  return result;
}

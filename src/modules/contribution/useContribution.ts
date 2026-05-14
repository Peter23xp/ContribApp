import { useState, useCallback } from 'react';
import { ContributionParams, ContributionResult } from './types';
import { contribute } from './ContributionService';

interface UseContributionReturn {
  initiatePayment: (params: ContributionParams) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  result: ContributionResult | null;
  reset: () => void;
}

export function useContribution(): UseContributionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContributionResult | null>(null);

  const initiatePayment = useCallback(async (params: ContributionParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const outcome = await contribute(params);

    setResult(outcome);
    if (!outcome.success) {
      setError(outcome.error ?? 'UNKNOWN_ERROR');
    }
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { initiatePayment, isLoading, error, result, reset };
}

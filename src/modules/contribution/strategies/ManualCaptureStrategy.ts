import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';
import { analyzePaymentCapture } from '../../../services/geminiService';
import { uploadFile } from '../../../services/storageService';
import { submitContribution } from '../../../services/contributionService';

export class ManualCaptureStrategy implements PaymentStrategy {
  readonly name = 'manual_capture' as const;

  async initiatePayment(params: ContributionParams): Promise<ContributionResult> {
    if (!params.imageUri || !params.imageBase64) {
      return {
        success: false,
        strategyUsed: this.name,
        error: 'IMAGE_REQUIRED',
      };
    }

    let captureImageUrl: string;
    let captureImagePath: string;
    try {
      const upload = await uploadFile(params.imageUri, 'receipts');
      captureImageUrl = upload.url;
      captureImagePath = upload.key;
    } catch (err: any) {
      return {
        success: false,
        strategyUsed: this.name,
        error: err?.message ?? 'UPLOAD_FAILED',
      };
    }

    let geminiAnalysis: unknown;
    try {
      geminiAnalysis = await analyzePaymentCapture(
        params.imageBase64,
        params.amount.value,
        params.amount.currency,
      );
    } catch (err: any) {
      return {
        success: false,
        strategyUsed: this.name,
        error: err?.message ?? 'GEMINI_FAILED',
      };
    }

    let contributionId: string;
    try {
      contributionId = await submitContribution({
        groupId: params.groupId,
        memberUid: params.memberUid,
        memberName: params.memberName,
        periodMonth: params.periodMonth,
        amountDue: params.amount.value,
        currency: params.amount.currency,
        captureImageUrl,
        captureImagePath,
        geminiAnalysis,
      });
    } catch (err: any) {
      return {
        success: false,
        strategyUsed: this.name,
        error: err?.message ?? 'SUBMIT_FAILED',
      };
    }

    return {
      success: true,
      contributionId,
      strategyUsed: this.name,
      rawAnalysis: geminiAnalysis,
    };
  }
}

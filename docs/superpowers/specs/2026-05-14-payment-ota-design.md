# Payment OTA Architecture — Design Spec

**Date:** 2026-05-14
**Status:** Approved

---

## Problem

ContribApp currently processes contributions via a manual flow: user captures a screenshot, uploads it to Cloudflare R2, and a Gemini AI analysis is run to extract payment metadata. A treasurer then reviews and approves.

No payment API (Airtel Money, M-Pesa, Orange Money, etc.) is yet integrated for the DRC market. When one becomes available, the goal is to **switch payment strategies without recompiling or republishing the app**.

---

## Solution: Strategy Pattern + Remote Config (OTA)

The contribution module is refactored into a **Strategy Pattern** where:
- Each payment method (manual capture, Airtel Money, M-Pesa, etc.) is a separate `PaymentStrategy` implementation.
- A `PaymentStrategyFactory` reads a remote JSON config to select the active strategy at app startup.
- The remote config is served by the existing **Cloudflare Worker** via a new route.
- The app caches the config locally (AsyncStorage, TTL 1h) for offline resilience.

Switching from manual to Airtel Money in production = **change one env var on Cloudflare + redeploy Worker**. No app update required.

---

## Architecture

### Module Structure

```
src/
  modules/
    contribution/
      types.ts                      ← All shared interfaces
      strategies/
        ManualCaptureStrategy.ts    ← Wraps existing Gemini flow
        AirtelMoneyStrategy.ts      ← Stub, ready to wire
        MobileMoneyStrategy.ts      ← Generic stub for other operators
      PaymentStrategyFactory.ts     ← Reads remote config, returns active strategy
      ContributionService.ts        ← Orchestrates: strategy + Firestore log
      useContribution.ts            ← React hook for UI
  config/
    remotePaymentConfig.ts          ← Fetch + AsyncStorage cache + fallback

cloudflare-worker/src/index.ts      ← Add GET /api/config/payment route

docs/
  PAYMENT_OTA.md                    ← How to add a new aggregator (3 steps)
```

### Data Flow

```
UI (SubmitContributionScreen)
  └─ useContribution().initiatePayment(params)
       └─ ContributionService.contribute(params)
            ├─ PaymentStrategyFactory.getStrategy()
            │    └─ remotePaymentConfig.getConfig()  ← AsyncStorage cache or Cloudflare Worker
            ├─ strategy.initiatePayment(params)
            │    └─ [ManualCaptureStrategy] upload R2 → Gemini → submitContribution()
            ├─ Log entry → AsyncStorage contributions_log
            └─ return ContributionResult
```

---

## Types (`src/modules/contribution/types.ts`)

```typescript
type Currency = 'CDF' | 'USD';

type PaymentOperator =
  | 'manual_capture'
  | 'airtel_money'
  | 'm_pesa'
  | 'orange_money'
  | 'mtn_momo';

interface ContributionParams {
  groupId: string;
  memberUid: string;
  memberName: string;
  periodMonth: string;          // 'YYYY-MM'
  amount: {
    value: number;
    currency: Currency;
  };
  phoneNumber?: string;         // Validated DRC regex before passing to strategy
  imageBase64?: string;         // Required by ManualCaptureStrategy
  imageUri?: string;            // Local file URI for R2 upload
}

interface ContributionResult {
  success: boolean;
  contributionId?: string;
  transactionRef?: string;
  strategyUsed: PaymentOperator;
  error?: string;
  rawAnalysis?: unknown;        // GeminiAnalysis for manual_capture
}

interface PaymentStrategy {
  name: PaymentOperator;
  initiatePayment(params: ContributionParams): Promise<ContributionResult>;
  verifyPayment?(transactionId: string): Promise<boolean>;
}

interface StrategyConfig {
  enabled: boolean;
  apiBaseUrl?: string;
  [key: string]: unknown;
}

interface RemotePaymentConfig {
  activeStrategy: PaymentOperator;
  strategies: Partial<Record<PaymentOperator, StrategyConfig>>;
}

interface ContributionLogEntry {
  id: string;
  date: string;                 // ISO 8601
  amount: number;
  currency: Currency;
  strategyUsed: PaymentOperator;
  status: 'success' | 'failure' | 'pending';
  contributionId?: string;
  error?: string;
}
```

---

## DRC Business Rules

- **Currency:** `CDF` (Franc Congolais) or `USD`. Both supported.
- **Phone validation regex:** `/^(\+?243|0)(8[1-9]|9[0-9])\d{7}$/`
- **Remote config cache:** AsyncStorage key `@payment_config`, TTL 1 hour.
- **Fallback chain:** fetch remote → cached config → hardcoded `manual_capture` default.
- **No hardcoded API keys:** all keys arrive via `strategies[name]` in the remote config (encrypted at rest on Cloudflare).
- **Logging:** every `contribute()` call writes a `ContributionLogEntry` to AsyncStorage key `@contributions_log` (JSON array, capped at 500 entries).

---

## Remote Config Shape

```json
{
  "activeStrategy": "manual_capture",
  "strategies": {
    "manual_capture": { "enabled": true },
    "airtel_money":   { "enabled": false, "apiBaseUrl": "" },
    "m_pesa":         { "enabled": false, "apiBaseUrl": "" },
    "orange_money":   { "enabled": false, "apiBaseUrl": "" },
    "mtn_momo":       { "enabled": false, "apiBaseUrl": "" }
  }
}
```

Served by `GET /api/config/payment` on the Cloudflare Worker.  
Protected by `X-App-Token: <APP_TOKEN>` header.  
`activeStrategy` is controlled by a Cloudflare env var `PAYMENT_ACTIVE_STRATEGY` (default: `"manual_capture"`).

---

## Cloudflare Worker Changes

Add one route to existing `cloudflare-worker/src/index.ts`:

```
GET /api/config/payment
  Header: X-App-Token: <APP_TOKEN>
  Response: RemotePaymentConfig JSON
```

New env vars needed in `wrangler.toml`:
- `APP_TOKEN` — secret token validated from mobile app
- `PAYMENT_ACTIVE_STRATEGY` — current active strategy name (default `manual_capture`)

---

## ManualCaptureStrategy Behavior

Wraps the **existing flow exactly** — no behavioral change:
1. Validate `params.imageUri` and `params.imageBase64` are present.
2. Upload image via `storageService.uploadFile(imageUri, 'receipts')` → get `captureImageUrl`.
3. Call `geminiService.analyzePaymentCapture(imageBase64, amount, currency)`.
4. Call `contributionService.submitContribution(...)` (existing Firestore write).
5. Return `ContributionResult` with `rawAnalysis: GeminiAnalysis`.

**No changes to `geminiService.ts` or the existing `contributionService.ts`.**

---

## Stub Strategy Behavior

`AirtelMoneyStrategy` and `MobileMoneyStrategy` both:
- Implement `PaymentStrategy` interface with correct types.
- `initiatePayment()` throws `Error('NOT_IMPLEMENTED: Airtel Money API not yet wired')`.
- Include a clear `// TODO:` block documenting what to implement.

---

## useContribution Hook API

```typescript
const { initiatePayment, isLoading, error, result } = useContribution();

await initiatePayment(params: ContributionParams): Promise<void>
// sets result on success, error on failure, manages isLoading state
```

---

## Integration with Existing UI

The existing `SubmitContributionScreen.tsx` currently calls `contributionService.submitContribution()` and `geminiService.analyzePaymentCapture()` directly. After this change, it will call `useContribution().initiatePayment()` instead. The Gemini + upload logic moves into `ManualCaptureStrategy` — the UI just gets a result back.

**No other screens are changed.**

---

## PAYMENT_OTA.md — Adding a New Aggregator

Document explains in 3 steps:
1. Create `src/modules/contribution/strategies/YourAggregatorStrategy.ts` implementing `PaymentStrategy`.
2. Register it in `PaymentStrategyFactory.ts` (one `case` in the switch).
3. Add the aggregator key to the Cloudflare Worker's `PAYMENT_ACTIVE_STRATEGY` options and update the remote config JSON default.

No recompile, no store publish needed once registered.

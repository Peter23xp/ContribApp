# Adding a New Payment Aggregator (OTA)

This document explains how to add a new payment aggregator to ContribApp without recompiling the app or publishing a new version to the store.

## How it works

The app fetches the active payment strategy from the Cloudflare Worker (`GET /api/config/payment`) at startup. The `PaymentStrategyFactory` instantiates the correct strategy class based on the `activeStrategy` field. Switching strategies = changing one Cloudflare env var and redeploying the Worker — no app update required.

**Fallback chain:** network → AsyncStorage cache (TTL 1h) → hardcoded `manual_capture` default.

---

## Step 1 — Create the Strategy file

Create `src/modules/contribution/strategies/YourAggregatorStrategy.ts`:

```typescript
import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';

export class YourAggregatorStrategy implements PaymentStrategy {
  // name must match the key used in RemotePaymentConfig and PaymentOperator union
  readonly name = 'your_aggregator' as const;

  async initiatePayment(params: ContributionParams): Promise<ContributionResult> {
    // 1. Retrieve API credentials — they arrive via the StrategyConfig object
    //    in getRemotePaymentConfig().strategies['your_aggregator']
    // 2. params.phoneNumber is already DRC-validated by ContributionService
    // 3. Call the aggregator API
    // 4. Return ContributionResult
    throw new Error('NOT_IMPLEMENTED');
  }

  // Optional: implement verifyPayment for polling/webhook reconciliation
  async verifyPayment(transactionId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED');
  }
}
```

---

## Step 2 — Register in PaymentStrategyFactory and types

**In `src/modules/contribution/types.ts`**, add to the `PaymentOperator` union:

```typescript
export type PaymentOperator =
  | 'manual_capture'
  | 'airtel_money'
  | 'm_pesa'
  | 'orange_money'
  | 'mtn_momo'
  | 'your_aggregator';  // ← add this line
```

**In `src/modules/contribution/PaymentStrategyFactory.ts`**, add a `case` in `buildStrategy()`:

```typescript
import { YourAggregatorStrategy } from './strategies/YourAggregatorStrategy';

// inside buildStrategy():
case 'your_aggregator':
  return new YourAggregatorStrategy();
```

---

## Step 3 — Update Cloudflare Worker and activate

**In `cloudflare-worker/src/index.ts`**, add your aggregator key to the `strategies` object in the `/api/config/payment` handler:

```typescript
const config = {
  activeStrategy,
  strategies: {
    manual_capture: { enabled: true },
    airtel_money:   { enabled: false, apiBaseUrl: '' },
    m_pesa:         { enabled: false, apiBaseUrl: '' },
    orange_money:   { enabled: false, apiBaseUrl: '' },
    mtn_momo:       { enabled: false, apiBaseUrl: '' },
    your_aggregator: { enabled: false, apiBaseUrl: '' },  // ← add this line
  },
};
```

Deploy the Worker, then activate:

```bash
npx wrangler secret put PAYMENT_ACTIVE_STRATEGY
# Enter: your_aggregator

npx wrangler deploy
```

The app picks up the new strategy within 1 hour (TTL cache), with no app store update required.

---

## Security notes

- API keys for the aggregator must be stored as Cloudflare Worker secrets (`npx wrangler secret put`), never in `wrangler.toml`.
- Surface them to the app via the `strategies.your_aggregator` config object returned by the Worker.
- The mobile app never hardcodes secrets — all credentials arrive from the remote config at runtime.

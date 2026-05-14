# Payment OTA Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encapsulate the existing manual Gemini contribution flow into a Strategy Pattern with Remote Config, enabling payment aggregator switching (Airtel Money, M-Pesa, etc.) without app recompilation or store republishing.

**Architecture:** Module-isolated Strategy Pattern — `src/modules/contribution/` contains all strategy code. `PaymentStrategyFactory` reads a remote JSON config (with AsyncStorage cache + offline fallback) served by the existing Cloudflare Worker. The existing `contributionService.ts` and `geminiService.ts` are NOT modified; they are called from within `ManualCaptureStrategy`.

**Tech Stack:** React Native / Expo, TypeScript, AsyncStorage, Cloudflare Worker (Wrangler), existing Firebase/Firestore, existing geminiService, existing storageService.

---

## File Map

### New files (create)
| Path | Responsibility |
|------|---------------|
| `src/modules/contribution/types.ts` | All shared interfaces: `PaymentStrategy`, `ContributionParams`, `ContributionResult`, `RemotePaymentConfig`, `ContributionLogEntry` |
| `src/modules/contribution/strategies/ManualCaptureStrategy.ts` | Wraps existing R2 upload + Gemini flow |
| `src/modules/contribution/strategies/AirtelMoneyStrategy.ts` | Typed stub, NOT_IMPLEMENTED |
| `src/modules/contribution/strategies/MobileMoneyStrategy.ts` | Generic typed stub, NOT_IMPLEMENTED |
| `src/modules/contribution/PaymentStrategyFactory.ts` | Reads config, instantiates correct strategy |
| `src/modules/contribution/ContributionService.ts` | Orchestrates strategy + local log |
| `src/modules/contribution/useContribution.ts` | React hook: `{ initiatePayment, isLoading, error, result }` |
| `src/config/remotePaymentConfig.ts` | Fetch + AsyncStorage cache (TTL 1h) + fallback |
| `docs/PAYMENT_OTA.md` | How to add a new aggregator in 3 steps |

### Modified files
| Path | Change |
|------|--------|
| `cloudflare-worker/src/index.ts` | Add `GET /api/config/payment` route |
| `cloudflare-worker/wrangler.toml` | Add `APP_TOKEN` and `PAYMENT_ACTIVE_STRATEGY` env vars |
| `src/utils/validatePhone.ts` | Implement DRC phone regex validation |

---

## Task 1: Define all types in `types.ts`

**Files:**
- Create: `src/modules/contribution/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/modules/contribution/types.ts

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors from `src/modules/contribution/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/types.ts
git commit -m "feat(ota): define PaymentStrategy types and interfaces"
```

---

## Task 2: Implement DRC phone validation utility

**Files:**
- Modify: `src/utils/validatePhone.ts`

- [ ] **Step 1: Implement the validation function**

```typescript
// src/utils/validatePhone.ts

const DRC_PHONE_REGEX = /^(\+?243|0)(8[1-9]|9[0-9])\d{7}$/;

export function validatePhone(phone: string): boolean {
  return DRC_PHONE_REGEX.test(phone.trim());
}

export function normalizeDrcPhone(phone: string): string {
  const trimmed = phone.trim().replace(/\s/g, '');
  if (trimmed.startsWith('+243')) return trimmed;
  if (trimmed.startsWith('243')) return `+${trimmed}`;
  if (trimmed.startsWith('0')) return `+243${trimmed.slice(1)}`;
  return trimmed;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/validatePhone.ts
git commit -m "feat(ota): implement DRC phone validation regex"
```

---

## Task 3: Implement `remotePaymentConfig.ts`

**Files:**
- Create: `src/config/remotePaymentConfig.ts`

- [ ] **Step 1: Create the remote config module**

```typescript
// src/config/remotePaymentConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemotePaymentConfig, PaymentOperator } from '../modules/contribution/types';

const CACHE_KEY = '@payment_config';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const DEFAULT_CONFIG: RemotePaymentConfig = {
  activeStrategy: 'manual_capture',
  strategies: {
    manual_capture: { enabled: true },
    airtel_money: { enabled: false, apiBaseUrl: '' },
    m_pesa: { enabled: false, apiBaseUrl: '' },
    orange_money: { enabled: false, apiBaseUrl: '' },
    mtn_momo: { enabled: false, apiBaseUrl: '' },
  },
};

interface CachedConfig {
  config: RemotePaymentConfig;
  fetchedAt: number;
}

async function readCache(): Promise<RemotePaymentConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedConfig = JSON.parse(raw);
    const age = Date.now() - cached.fetchedAt;
    if (age > CACHE_TTL_MS) return null;
    return cached.config;
  } catch {
    return null;
  }
}

async function writeCache(config: RemotePaymentConfig): Promise<void> {
  try {
    const cached: CachedConfig = { config, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Cache write failure is non-fatal
  }
}

export async function getRemotePaymentConfig(): Promise<RemotePaymentConfig> {
  // 1. Try network
  const workerUrl = process.env.EXPO_PUBLIC_CF_WORKER_URL;
  const appToken = process.env.EXPO_PUBLIC_APP_TOKEN;

  if (workerUrl && appToken) {
    try {
      const response = await fetch(`${workerUrl}/api/config/payment`, {
        method: 'GET',
        headers: { 'X-App-Token': appToken },
      });
      if (response.ok) {
        const config: RemotePaymentConfig = await response.json();
        await writeCache(config);
        return config;
      }
    } catch {
      // Network failure — fall through to cache
    }
  }

  // 2. Try cache
  const cached = await readCache();
  if (cached) return cached;

  // 3. Hardcoded default
  return DEFAULT_CONFIG;
}

export async function clearPaymentConfigCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/config/remotePaymentConfig.ts
git commit -m "feat(ota): implement remote payment config with AsyncStorage cache and offline fallback"
```

---

## Task 4: Implement `ManualCaptureStrategy`

**Files:**
- Create: `src/modules/contribution/strategies/ManualCaptureStrategy.ts`

- [ ] **Step 1: Create the strategy**

```typescript
// src/modules/contribution/strategies/ManualCaptureStrategy.ts
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

    // 1. Upload image to Cloudflare R2
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

    // 2. Analyze with Gemini
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

    // 3. Submit to Firestore via existing contributionService
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/strategies/ManualCaptureStrategy.ts
git commit -m "feat(ota): implement ManualCaptureStrategy wrapping existing Gemini flow"
```

---

## Task 5: Implement stub strategies

**Files:**
- Create: `src/modules/contribution/strategies/AirtelMoneyStrategy.ts`
- Create: `src/modules/contribution/strategies/MobileMoneyStrategy.ts`

- [ ] **Step 1: Create `AirtelMoneyStrategy.ts`**

```typescript
// src/modules/contribution/strategies/AirtelMoneyStrategy.ts
import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';

export class AirtelMoneyStrategy implements PaymentStrategy {
  readonly name = 'airtel_money' as const;

  // TODO: Implement Airtel Money DRC API integration
  // Docs: https://developer.airtel.africa/apis
  // Required env vars (from remote config strategies.airtel_money):
  //   apiBaseUrl — Airtel Money API base URL
  //   clientId   — OAuth2 client ID
  //   clientSecret — OAuth2 client secret
  // Steps:
  //   1. POST /auth/oauth2/token to get access token
  //   2. POST /merchant/v2/payments/ with amount, currency, reference, subscriber.msisdn
  //   3. Poll GET /standard/v1/payments/{id} or handle callback webhook
  async initiatePayment(params: ContributionParams): Promise<ContributionResult> {
    throw new Error('NOT_IMPLEMENTED: Airtel Money API not yet wired');
  }

  async verifyPayment(transactionId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: Airtel Money verifyPayment not yet wired');
  }
}
```

- [ ] **Step 2: Create `MobileMoneyStrategy.ts`**

```typescript
// src/modules/contribution/strategies/MobileMoneyStrategy.ts
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
  async initiatePayment(params: ContributionParams): Promise<ContributionResult> {
    throw new Error('NOT_IMPLEMENTED: MobileMoney API not yet wired');
  }

  async verifyPayment(transactionId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: MobileMoney verifyPayment not yet wired');
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/modules/contribution/strategies/AirtelMoneyStrategy.ts src/modules/contribution/strategies/MobileMoneyStrategy.ts
git commit -m "feat(ota): add AirtelMoneyStrategy and MobileMoneyStrategy stubs"
```

---

## Task 6: Implement `PaymentStrategyFactory`

**Files:**
- Create: `src/modules/contribution/PaymentStrategyFactory.ts`

- [ ] **Step 1: Create the factory**

```typescript
// src/modules/contribution/PaymentStrategyFactory.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/PaymentStrategyFactory.ts
git commit -m "feat(ota): implement PaymentStrategyFactory with remote config integration"
```

---

## Task 7: Implement local contribution log helpers

These are small helpers used by `ContributionService`. Implement them inline here so Task 8 has no dependencies.

**Files:**
- Create: `src/modules/contribution/contributionLog.ts`

- [ ] **Step 1: Create the log module**

```typescript
// src/modules/contribution/contributionLog.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContributionLogEntry } from './types';

const LOG_KEY = '@contributions_log';
const MAX_ENTRIES = 500;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function appendLogEntry(
  entry: Omit<ContributionLogEntry, 'id' | 'date'>
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const log: ContributionLogEntry[] = raw ? JSON.parse(raw) : [];

    const newEntry: ContributionLogEntry = {
      ...entry,
      id: generateId(),
      date: new Date().toISOString(),
    };

    log.unshift(newEntry);
    if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES);

    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // Log write failure is non-fatal
  }
}

export async function getContributionLog(): Promise<ContributionLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/contributionLog.ts
git commit -m "feat(ota): add AsyncStorage-based contribution log with 500-entry cap"
```

---

## Task 8: Implement `ContributionService`

**Files:**
- Create: `src/modules/contribution/ContributionService.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/modules/contribution/ContributionService.ts
import { ContributionParams, ContributionResult } from './types';
import { getActiveStrategy } from './PaymentStrategyFactory';
import { appendLogEntry } from './contributionLog';
import { validatePhone } from '../../utils/validatePhone';

export async function contribute(params: ContributionParams): Promise<ContributionResult> {
  // Validate DRC phone if provided
  if (params.phoneNumber && !validatePhone(params.phoneNumber)) {
    return {
      success: false,
      strategyUsed: 'manual_capture',
      error: 'INVALID_PHONE_NUMBER',
    };
  }

  const strategy = await getActiveStrategy();

  // Log attempt before calling strategy (status: pending)
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

  // Update log with final status
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/ContributionService.ts
git commit -m "feat(ota): implement ContributionService orchestrating strategy + log"
```

---

## Task 9: Implement `useContribution` hook

**Files:**
- Modify: `src/modules/contribution/useContribution.ts` (create as new file — replaces the empty stub at `src/hooks/usePayment.ts` in terms of functionality)

- [ ] **Step 1: Create the hook**

```typescript
// src/modules/contribution/useContribution.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/contribution/useContribution.ts
git commit -m "feat(ota): implement useContribution hook with loading/error/result state"
```

---

## Task 10: Add `GET /api/config/payment` to Cloudflare Worker

**Files:**
- Modify: `cloudflare-worker/src/index.ts`
- Modify: `cloudflare-worker/wrangler.toml`

- [ ] **Step 1: Update the `Env` interface and add the new route in `cloudflare-worker/src/index.ts`**

In `cloudflare-worker/src/index.ts`, replace the entire file with:

```typescript
export interface Env {
  BUCKET: R2Bucket;
  UPLOAD_SECRET: string;
  APP_TOKEN: string;
  PAYMENT_ACTIVE_STRATEGY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS,PUT,DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Token',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  if (!env.UPLOAD_SECRET) return false;
  return token === env.UPLOAD_SECRET;
}

function isAppTokenValid(request: Request, env: Env): boolean {
  const token = request.headers.get('X-App-Token');
  if (!token || !env.APP_TOKEN) return false;
  return token === env.APP_TOKEN;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── GET /api/config/payment ──────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/config/payment') {
      if (!isAppTokenValid(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const activeStrategy = env.PAYMENT_ACTIVE_STRATEGY || 'manual_capture';

      const config = {
        activeStrategy,
        strategies: {
          manual_capture: { enabled: true },
          airtel_money: { enabled: false, apiBaseUrl: '' },
          m_pesa: { enabled: false, apiBaseUrl: '' },
          orange_money: { enabled: false, apiBaseUrl: '' },
          mtn_momo: { enabled: false, apiBaseUrl: '' },
        },
      };

      // Mark the active strategy as enabled
      if (activeStrategy !== 'manual_capture' && config.strategies[activeStrategy as keyof typeof config.strategies] !== undefined) {
        (config.strategies[activeStrategy as keyof typeof config.strategies] as any).enabled = true;
      }

      return json(config);
    }

    // ── PUT /upload/<key> ────────────────────────────────────────────────────
    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      if (!isAuthorized(request, env)) {
        return json({ error: 'Not Authenticated' }, 401);
      }
      try {
        const key = decodeURIComponent(url.pathname.replace('/upload/', ''));
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        await env.BUCKET.put(key, request.body, {
          httpMetadata: { contentType },
        });

        const publicBaseUrl = 'https://pub-45a3bfa4592944adb4b365a939adcf46.r2.dev';
        return json({ url: `${publicBaseUrl}/${key}`, key });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // ── DELETE /delete ───────────────────────────────────────────────────────
    if (request.method === 'DELETE' && url.pathname === '/delete') {
      if (!isAuthorized(request, env)) {
        return json({ error: 'Not Authenticated' }, 401);
      }
      try {
        const body = await request.json() as { key: string };
        await env.BUCKET.delete(body.key);
        return json({ success: true });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    return new Response('ContribApp R2 Worker v2', { headers: corsHeaders });
  },
};
```

- [ ] **Step 2: Update `cloudflare-worker/wrangler.toml` to document new vars**

Add below the existing `[[r2_buckets]]` block:

```toml
# Payment config — set these via `npx wrangler secret put APP_TOKEN` and `npx wrangler secret put PAYMENT_ACTIVE_STRATEGY`
# PAYMENT_ACTIVE_STRATEGY controls which payment strategy the mobile app uses (OTA switch).
# Valid values: manual_capture | airtel_money | m_pesa | orange_money | mtn_momo
# Default: manual_capture
#
# To switch to Airtel Money in production without app recompile:
#   npx wrangler secret put PAYMENT_ACTIVE_STRATEGY   → enter: airtel_money
#   npx wrangler deploy
```

- [ ] **Step 3: Build the worker to verify TypeScript**

```bash
cd cloudflare-worker && npx wrangler deploy --dry-run
```
Expected: build succeeds, no TypeScript errors. (No actual deploy — dry-run only.)

- [ ] **Step 4: Commit**

```bash
git add cloudflare-worker/src/index.ts cloudflare-worker/wrangler.toml
git commit -m "feat(ota): add GET /api/config/payment endpoint to Cloudflare Worker"
```

---

## Task 11: Add `EXPO_PUBLIC_APP_TOKEN` to env example

**Files:**
- Modify: `.env.example` (or `.env` if `.env.example` doesn't exist — check first)

- [ ] **Step 1: Find and update the env file**

Run: `ls D:/PETER/ContribApp/.env* 2>/dev/null || echo "no env files"`

If `.env.example` exists, add to it:
```bash
# OTA Payment Config
EXPO_PUBLIC_APP_TOKEN=your_app_token_here
```

If only `.env` exists (no `.env.example`), add the same line to `.env`.

- [ ] **Step 2: Commit**

```bash
git add .env.example  # or .env if that's what you modified
git commit -m "feat(ota): add EXPO_PUBLIC_APP_TOKEN env var for payment config endpoint"
```

---

## Task 12: Write `PAYMENT_OTA.md`

**Files:**
- Create: `docs/PAYMENT_OTA.md`

- [ ] **Step 1: Create the guide**

```markdown
# Adding a New Payment Aggregator (OTA)

This document explains how to add a new payment aggregator to ContribApp without recompiling the app or publishing a new version to the store.

## How it works

The app fetches the active payment strategy from the Cloudflare Worker at startup. The `PaymentStrategyFactory` instantiates the correct strategy class. Switching strategies = changing a Cloudflare env var.

## Step 1 — Create the Strategy file

Create `src/modules/contribution/strategies/YourAggregatorStrategy.ts`:

```typescript
import { PaymentStrategy, ContributionParams, ContributionResult } from '../types';

export class YourAggregatorStrategy implements PaymentStrategy {
  readonly name = 'your_aggregator' as const; // must match the key in RemotePaymentConfig

  async initiatePayment(params: ContributionParams): Promise<ContributionResult> {
    // 1. Get API credentials from remote config (they arrive via StrategyConfig)
    // 2. Validate params.phoneNumber (already validated by ContributionService)
    // 3. Call aggregator API
    // 4. Return ContributionResult
    throw new Error('NOT_IMPLEMENTED');
  }
}
```

## Step 2 — Register in PaymentStrategyFactory

In `src/modules/contribution/PaymentStrategyFactory.ts`, add a `case` in `buildStrategy()`:

```typescript
case 'your_aggregator':
  return new YourAggregatorStrategy();
```

Also add `'your_aggregator'` to the `PaymentOperator` union type in `src/modules/contribution/types.ts`.

## Step 3 — Update Cloudflare Worker and switch

In `cloudflare-worker/src/index.ts`, add your aggregator key to the `strategies` object in the `/api/config/payment` response:

```typescript
your_aggregator: { enabled: false, apiBaseUrl: '' },
```

Then deploy the Worker, and to activate:

```bash
npx wrangler secret put PAYMENT_ACTIVE_STRATEGY
# Enter: your_aggregator
npx wrangler deploy
```

The app will pick up the new strategy on next config fetch (within 1 hour due to TTL cache), with no app update required.

## Security notes

- API keys for the aggregator should be stored as Cloudflare secrets, not in wrangler.toml.
- Pass them to the app via the `strategies.your_aggregator` config object in the Worker response.
- The app never hardcodes secrets — they arrive from the remote config at runtime.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PAYMENT_OTA.md
git commit -m "docs: add PAYMENT_OTA.md guide for adding new payment aggregators"
```

---

## Task 13: Final integration verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Verify module barrel exports are correct**

Check that all new imports in each file resolve correctly by tracing:
- `useContribution.ts` → `ContributionService.ts` → `PaymentStrategyFactory.ts` → `ManualCaptureStrategy.ts` → `geminiService.ts`, `storageService.ts`, `contributionService.ts`
- `PaymentStrategyFactory.ts` → `remotePaymentConfig.ts`

Run: `npx tsc --noEmit` once more after tracing.
Expected: zero errors

- [ ] **Step 3: Verify no direct Gemini/R2 calls remain outside module**

Run:
```bash
grep -r "analyzePaymentCapture\|geminiService" src/screens/ src/components/ src/hooks/
```
Expected: zero matches (the call now lives only in `ManualCaptureStrategy.ts`)

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(ota): complete OTA payment strategy architecture — Strategy Pattern + Remote Config"
```

---

## Checklist — Definition of Done

- [ ] `src/modules/contribution/types.ts` — all interfaces defined and exported
- [ ] `ManualCaptureStrategy` — wraps existing Gemini flow exactly, no behavior change
- [ ] `AirtelMoneyStrategy` and `MobileMoneyStrategy` — typed stubs with clear TODO
- [ ] `PaymentStrategyFactory` — loads active strategy from remote config
- [ ] `ContributionService` — `contribute(params)` independent of any specific strategy
- [ ] `useContribution()` — returns `{ initiatePayment, isLoading, error, result }`
- [ ] `remotePaymentConfig.ts` — fetch + AsyncStorage TTL cache + offline fallback
- [ ] `GET /api/config/payment` — Cloudflare Worker route functional and documented
- [ ] `docs/PAYMENT_OTA.md` — 3-step guide for adding new aggregator
- [ ] No direct Gemini or payment API calls in UI layer — all through `ContributionService`
- [ ] `npx tsc --noEmit` passes with zero errors

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemotePaymentConfig } from '../modules/contribution/types';

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

  const cached = await readCache();
  if (cached) return cached;

  return DEFAULT_CONFIG;
}

export async function clearPaymentConfigCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

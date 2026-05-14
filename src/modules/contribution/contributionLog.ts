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

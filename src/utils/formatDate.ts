/**
 * Converts any Firestore Timestamp, Date, number (millis), or ISO string
 * to a native Date. Returns null if absent or unparseable.
 */
export function safeDate(value: any): Date | null {
  if (value == null) return null;
  // Firestore Timestamp
  if (typeof value?.toDate === 'function') {
    const d = value.toDate() as Date;
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? new Date(value) : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format any date value (Timestamp, Date, number, string) for French locale.
 * Returns `fallback` on null / invalid instead of "Invalid Date".
 */
export function fmtDate(
  value: any,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
  fallback = '–'
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('fr-FR', opts);
}

/**
 * Same as fmtDate but includes time (HH:MM).
 */
export function fmtDateTime(
  value: any,
  opts: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  },
  fallback = '–'
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  return d.toLocaleString('fr-FR', opts);
}

/**
 * Human-readable relative time ("il y a 3h", "hier", etc.)
 * Safe against any input type.
 */
export function relativeTime(value: any): string {
  const date = safeDate(value);
  if (!date) return '–';
  const diffMs = Date.now() - date.getTime();
  const diffMin  = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay  = Math.floor(diffMs / 86_400_000);
  if (diffMin  <  1) return "À l'instant";
  if (diffMin  < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  if (diffDay  ===1) return 'hier';
  if (diffDay  <  7) return `il y a ${diffDay}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

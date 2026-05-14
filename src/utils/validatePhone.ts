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

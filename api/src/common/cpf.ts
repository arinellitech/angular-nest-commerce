/**
 * CPF (Brazilian individual taxpayer id) helpers. Stored as 11 digits,
 * never logged, masked in every API response.
 */

/** Strips the usual punctuation ("529.982.247-25" → "52998224725"); anything else is kept so validation fails. */
export function normalizeCpf(value: string): string {
  return value.replace(/[.\-\s]/g, '');
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** 11 digits, not all equal, both check digits correct. Accepts punctuation. */
export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  return (
    checkDigit(digits, 9) === Number(digits[9]) &&
    checkDigit(digits, 10) === Number(digits[10])
  );
}

/** "52998224725" → "***.982.247-**" (keeps the middle six digits, enough to recognize it). */
export function maskCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return '***';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

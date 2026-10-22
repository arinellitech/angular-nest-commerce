/**
 * Money helpers. Amounts are always integer minor units (cents).
 * Never do arithmetic on floats anywhere in this codebase.
 */
export interface Money {
  amount: number;
  currency: string;
  formatted: string;
}

export function formatMoney(
  cents: number,
  currency = 'BRL',
  locale = 'pt-BR',
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    cents / 100,
  );
}

export function toMoney(cents: number, currency = 'BRL'): Money {
  return { amount: cents, currency, formatted: formatMoney(cents, currency) };
}

export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent) / 100);
}

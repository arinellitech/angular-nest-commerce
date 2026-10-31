/** Format integer cents as currency. The API already sends `formatted`; use this for client-side math (cart totals). */
export function formatMoney(cents: number, currency = 'BRL', locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function discountPercent(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}

export interface MoneyParts {
  symbol: string;
  whole: string;
  fraction: string;
}

/** Split integer cents into currency symbol, whole and fraction so prices can render as `R$ 199⁹⁰`. */
export function moneyParts(cents: number, currency = 'BRL', locale = 'pt-BR'): MoneyParts {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(
    cents / 100,
  );
  const join = (types: Intl.NumberFormatPartTypes[]) =>
    parts
      .filter((part) => types.includes(part.type))
      .map((part) => part.value)
      .join('');
  return {
    symbol: join(['currency']),
    whole: join(['minusSign', 'integer', 'group']),
    fraction: join(['fraction']),
  };
}

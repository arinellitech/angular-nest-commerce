/** The store sells in Brazil: the year in an order number follows Brasília time. */
export const STORE_TIME_ZONE = 'America/Sao_Paulo';

const yearFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
});

/**
 * ORD-2026-000042. `sequence` comes from the Postgres sequence
 * `order_number_seq` (never from count(), which races). The counter is global,
 * not per year; it widens past six digits instead of wrapping.
 */
export function formatOrderNumber(
  prefix: string,
  placedAt: Date,
  sequence: number,
): string {
  const year = yearFormat.format(placedAt);
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

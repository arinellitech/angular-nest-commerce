import { formatOrderNumber } from './order-number.js';

describe('formatOrderNumber', () => {
  it('pads the sequence to six digits', () => {
    expect(formatOrderNumber('ORD', new Date('2026-10-31T12:00:00Z'), 42)).toBe(
      'ORD-2026-000042',
    );
  });

  it('uses the year in Brasília time, not UTC', () => {
    // 2027-01-01 01:00 UTC is still 2026-12-31 22:00 in São Paulo.
    expect(formatOrderNumber('ORD', new Date('2027-01-01T01:00:00Z'), 1)).toBe(
      'ORD-2026-000001',
    );
  });

  it('widens instead of wrapping after 999999', () => {
    expect(
      formatOrderNumber('ORD', new Date('2026-06-01T12:00:00Z'), 1_234_567),
    ).toBe('ORD-2026-1234567');
  });
});

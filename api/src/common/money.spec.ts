import { formatMoney, percentOf, toMoney } from './money.js';

describe('money', () => {
  it('formats cents as BRL', () => {
    expect(formatMoney(19990).replace(/\s/g, ' ')).toBe('R$ 199,90');
  });

  it('builds the resource shape', () => {
    expect(toMoney(1000)).toEqual({
      amount: 1000,
      currency: 'BRL',
      formatted: expect.stringContaining('10,00'),
    });
  });

  it('computes percentages in integer cents, rounding down', () => {
    expect(percentOf(19999, 10)).toBe(1999);
    expect(percentOf(1, 50)).toBe(0);
  });
});

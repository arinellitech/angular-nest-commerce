import { discountPercent, formatMoney, moneyParts } from './money';

describe('money utils', () => {
  it('formats cents as BRL', () => {
    expect(formatMoney(19990).replace(/\s/g, ' ')).toBe('R$ 199,90');
  });

  it('computes discount percent from compare-at price', () => {
    expect(discountPercent(8000, 10000)).toBe(20);
    expect(discountPercent(10000, 8000)).toBeNull();
    expect(discountPercent(10000, null)).toBeNull();
  });

  it('splits cents into symbol, whole and fraction', () => {
    expect(moneyParts(19990)).toEqual({ symbol: 'R$', whole: '199', fraction: '90' });
    expect(moneyParts(123456705)).toEqual({ symbol: 'R$', whole: '1.234.567', fraction: '05' });
  });
});

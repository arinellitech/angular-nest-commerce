import { discountPercent, formatMoney } from './money';

describe('money utils', () => {
  it('formats cents as BRL', () => {
    expect(formatMoney(19990).replace(/\s/g, ' ')).toBe('R$ 199,90');
  });

  it('computes discount percent from compare-at price', () => {
    expect(discountPercent(8000, 10000)).toBe(20);
    expect(discountPercent(10000, 8000)).toBeNull();
    expect(discountPercent(10000, null)).toBeNull();
  });
});

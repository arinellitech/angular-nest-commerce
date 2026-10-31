import { computeCartTotals, type CartTotalsInput } from './cart.rules.js';

const coupon = {
  type: 'percent',
  value: 10,
  minSubtotalCents: 5000,
  maxUses: null,
  uses: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

const base: CartTotalsInput = {
  items: [{ quantity: 2, unitPriceCents: 4000 }],
  coupon: null,
  shippingFlatRateCents: 1990,
  shippingFreeOverCents: 29900,
};

describe('computeCartTotals', () => {
  it('sums lines and adds flat shipping below the free threshold', () => {
    expect(computeCartTotals(base)).toEqual({
      subtotalCents: 8000,
      discountCents: 0,
      shippingCents: 1990,
      totalCents: 9990,
      couponApplied: false,
    });
  });

  it('applies a percent coupon in integer cents', () => {
    const totals = computeCartTotals({ ...base, coupon });
    expect(totals.discountCents).toBe(800);
    expect(totals.totalCents).toBe(8000 - 800 + 1990);
    expect(totals.couponApplied).toBe(true);
  });

  it('ignores a coupon whose minimum is no longer met', () => {
    const totals = computeCartTotals({
      ...base,
      items: [{ quantity: 1, unitPriceCents: 4000 }],
      coupon,
    });
    expect(totals.discountCents).toBe(0);
    expect(totals.couponApplied).toBe(false);
  });

  it('gives free shipping when the discounted merchandise reaches the threshold', () => {
    const items = [{ quantity: 1, unitPriceCents: 30000 }];
    expect(computeCartTotals({ ...base, items }).shippingCents).toBe(0);
    // 10% off drops 30000 to 27000, under the 29900 threshold.
    expect(computeCartTotals({ ...base, items, coupon }).shippingCents).toBe(
      1990,
    );
  });

  it('charges nothing for an empty cart', () => {
    expect(computeCartTotals({ ...base, items: [] })).toMatchObject({
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});

import {
  couponDiscount,
  isCouponRedeemable,
  type CouponLike,
} from './coupon.rules.js';

const base: CouponLike = {
  type: 'fixed',
  value: 1000,
  minSubtotalCents: 5000,
  maxUses: 1,
  uses: 0,
  startsAt: null,
  endsAt: new Date(Date.now() + 86_400_000),
  isActive: true,
};

describe('coupon rules', () => {
  it('computes a percent discount in integer cents', () => {
    expect(couponDiscount({ type: 'percent', value: 10 }, 19999)).toBe(1999);
  });

  it('never discounts more than the subtotal', () => {
    expect(couponDiscount({ type: 'fixed', value: 5000 }, 3000)).toBe(3000);
  });

  it('respects minimum subtotal, dates, usage limit and active flag', () => {
    expect(isCouponRedeemable(base, 4999)).toBe(false);
    expect(isCouponRedeemable(base, 5000)).toBe(true);
    expect(isCouponRedeemable({ ...base, uses: 1 }, 5000)).toBe(false);
    expect(isCouponRedeemable({ ...base, isActive: false }, 5000)).toBe(false);
    expect(
      isCouponRedeemable(
        { ...base, endsAt: new Date(Date.now() - 1000) },
        5000,
      ),
    ).toBe(false);
    expect(
      isCouponRedeemable(
        { ...base, startsAt: new Date(Date.now() + 1000) },
        5000,
      ),
    ).toBe(false);
  });
});

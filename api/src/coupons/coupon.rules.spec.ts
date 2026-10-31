import {
  couponDiscount,
  couponRejection,
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

describe('couponRejection', () => {
  it('names the reason a coupon cannot be used', () => {
    expect(couponRejection(base, 5000)).toBeNull();
    expect(couponRejection(base, 100)).toBe('below_minimum');
    expect(couponRejection({ ...base, isActive: false }, 5000)).toBe(
      'inactive',
    );
    expect(couponRejection({ ...base, uses: 1 }, 5000)).toBe('exhausted');
    expect(
      couponRejection({ ...base, endsAt: new Date(Date.now() - 1000) }, 5000),
    ).toBe('expired');
    expect(
      couponRejection({ ...base, startsAt: new Date(Date.now() + 1000) }, 5000),
    ).toBe('not_started');
  });
});

import { percentOf } from '../common/money.js';

export const CouponType = { Percent: 'percent', Fixed: 'fixed' } as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export interface CouponLike {
  type: string;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  uses: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export function isCouponRedeemable(
  coupon: CouponLike,
  subtotalCents: number,
  at: Date = new Date(),
): boolean {
  return (
    coupon.isActive &&
    (coupon.startsAt === null || coupon.startsAt <= at) &&
    (coupon.endsAt === null || coupon.endsAt >= at) &&
    (coupon.maxUses === null || coupon.uses < coupon.maxUses) &&
    subtotalCents >= coupon.minSubtotalCents
  );
}

export function couponDiscount(
  coupon: Pick<CouponLike, 'type' | 'value'>,
  subtotalCents: number,
): number {
  const discount =
    coupon.type === CouponType.Percent
      ? percentOf(subtotalCents, coupon.value)
      : coupon.value;
  return Math.min(discount, subtotalCents);
}

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

export const CouponRejection = {
  Inactive: 'inactive',
  NotStarted: 'not_started',
  Expired: 'expired',
  Exhausted: 'exhausted',
  BelowMinimum: 'below_minimum',
} as const;
export type CouponRejection =
  (typeof CouponRejection)[keyof typeof CouponRejection];

/** Why a coupon cannot be used for this subtotal, or `null` when it can. */
export function couponRejection(
  coupon: CouponLike,
  subtotalCents: number,
  at: Date = new Date(),
): CouponRejection | null {
  if (!coupon.isActive) return CouponRejection.Inactive;
  if (coupon.startsAt !== null && coupon.startsAt > at)
    return CouponRejection.NotStarted;
  if (coupon.endsAt !== null && coupon.endsAt < at)
    return CouponRejection.Expired;
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses)
    return CouponRejection.Exhausted;
  if (subtotalCents < coupon.minSubtotalCents)
    return CouponRejection.BelowMinimum;
  return null;
}

export function isCouponRedeemable(
  coupon: CouponLike,
  subtotalCents: number,
  at: Date = new Date(),
): boolean {
  return couponRejection(coupon, subtotalCents, at) === null;
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

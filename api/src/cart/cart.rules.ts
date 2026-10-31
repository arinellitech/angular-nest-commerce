import { couponDiscount, isCouponRedeemable } from '../coupons/coupon.rules.js';
import type { CouponLike } from '../coupons/coupon.rules.js';

export interface CartTotalsInput {
  items: { quantity: number; unitPriceCents: number }[];
  coupon: (CouponLike & { type: string; value: number }) | null;
  shippingFlatRateCents: number;
  shippingFreeOverCents: number;
  at?: Date;
}

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  /** The coupon only counts while it is still redeemable for the current subtotal. */
  couponApplied: boolean;
}

/**
 * Cart arithmetic in integer cents.
 * - discount: the coupon, only while redeemable for the current subtotal
 * - shipping: flat rate, free once the discounted merchandise reaches
 *   `shippingFreeOverCents`; an empty cart ships nothing
 */
export function computeCartTotals(input: CartTotalsInput): CartTotals {
  const subtotalCents = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
  const couponApplied =
    input.coupon !== null &&
    isCouponRedeemable(input.coupon, subtotalCents, input.at);
  const discountCents = couponApplied
    ? couponDiscount(input.coupon!, subtotalCents)
    : 0;
  const merchandise = subtotalCents - discountCents;
  const shippingCents =
    subtotalCents === 0 || merchandise >= input.shippingFreeOverCents
      ? 0
      : input.shippingFlatRateCents;
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: merchandise + shippingCents,
    couponApplied,
  };
}

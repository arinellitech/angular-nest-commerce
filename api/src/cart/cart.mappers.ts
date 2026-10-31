import { toMoney, type Money } from '../common/money.js';
import type {
  Cart,
  CartItem,
  Coupon,
  Inventory,
  Product,
  ProductImage,
} from '../database/schema.js';
import {
  availableQuantity,
  imageUrl,
  type ProductImageResource,
} from '../catalog/catalog.mappers.js';
import { computeCartTotals } from './cart.rules.js';

/** Resource shapes — mirror storefront/src/app/core/api/types.ts and docs/api.md. */

export interface CartItemResource {
  id: number;
  product: {
    id: number;
    name: string;
    slug: string;
    images: ProductImageResource[];
  };
  quantity: number;
  /** Price snapshot taken when the line was added/changed; checkout re-validates it. */
  unit_price: Money;
  total: Money;
  /** Units that can still be bought right now (0 when the product left the catalog). */
  available_quantity: number;
}

export interface CartResource {
  id: string;
  token: string;
  currency: string;
  status: string;
  items: CartItemResource[];
  coupon: { code: string; discount: Money } | null;
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  expires_at: string | null;
}

export type CartWithRelations = Cart & {
  coupon: Coupon | null;
  items: (CartItem & {
    product: Product & { images: ProductImage[]; inventory: Inventory | null };
  })[];
};

export interface ShippingRates {
  flatRateCents: number;
  freeOverCents: number;
}

function isPurchasable(product: Product, at: Date): boolean {
  return (
    product.isActive &&
    product.deletedAt === null &&
    product.publishedAt !== null &&
    product.publishedAt <= at
  );
}

export function toCartResource(
  cart: CartWithRelations,
  shipping: ShippingRates,
  at: Date = new Date(),
): CartResource {
  const totals = computeCartTotals({
    items: cart.items,
    coupon: cart.coupon,
    shippingFlatRateCents: shipping.flatRateCents,
    shippingFreeOverCents: shipping.freeOverCents,
    at,
  });
  const money = (cents: number) => toMoney(cents, cart.currency);

  return {
    id: cart.id,
    token: cart.token,
    currency: cart.currency,
    status: cart.status,
    items: cart.items.map((item) => ({
      id: item.id,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        images: item.product.images.map((image) => ({
          id: image.id,
          url: imageUrl(image),
          alt: image.alt,
          position: image.position,
        })),
      },
      quantity: item.quantity,
      unit_price: money(item.unitPriceCents),
      total: money(item.quantity * item.unitPriceCents),
      available_quantity: isPurchasable(item.product, at)
        ? availableQuantity(item.product.inventory)
        : 0,
    })),
    coupon:
      totals.couponApplied && cart.coupon
        ? { code: cart.coupon.code, discount: money(totals.discountCents) }
        : null,
    subtotal: money(totals.subtotalCents),
    discount: money(totals.discountCents),
    shipping: money(totals.shippingCents),
    total: money(totals.totalCents),
    expires_at: cart.expiresAt?.toISOString() ?? null,
  };
}

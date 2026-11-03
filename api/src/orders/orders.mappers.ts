import { maskCpf } from '../common/cpf.js';
import { toMoney, type Money } from '../common/money.js';
import {
  imageUrl,
  type ProductImageResource,
} from '../catalog/catalog.mappers.js';
import type {
  Coupon,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductImage,
} from '../database/schema.js';
import type {
  PaymentMethod,
  PaymentStatus,
} from '../payments/payment.types.js';
import type { OrderStatus } from './order-status.js';

/** Resource shapes — mirror storefront/src/app/core/api/types.ts and docs/api.md. */

export interface OrderItemResource {
  id: number;
  /** `null` once the product is deleted; name, sku and prices are snapshots and stay. */
  product_id: number | null;
  slug: string | null;
  image: ProductImageResource | null;
  name: string;
  sku: string;
  quantity: number;
  unit_price: Money;
  total: Money;
}

export interface PaymentResource {
  id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Money;
  /** Pix "copia e cola" (EMV). The storefront renders it as a QR code. */
  pix_copy_paste: string | null;
  /** Base64 PNG when the provider sends one (the mock does not). */
  pix_qr_code: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
}

export interface OrderResource {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  customer: {
    name: string;
    email: string;
    /** Masked: "***.982.247-**". */
    document: string;
    phone: string | null;
  };
  shipping_address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  items: OrderItemResource[];
  coupon: { code: string } | null;
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  /** Latest charge; `null` while the payment provider has not created it yet. */
  payment: PaymentResource | null;
  /** Grants read access to this order: GET /orders/{number}?token=… */
  access_token: string;
  placed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
}

export type OrderWithRelations = Order & {
  coupon: Coupon | null;
  items: (OrderItem & {
    product: (Product & { images: ProductImage[] }) | null;
  })[];
  payments: Payment[];
};

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

export function toPaymentResource(
  payment: Payment,
  currency: string,
): PaymentResource {
  return {
    id: payment.id,
    provider: payment.provider,
    method: payment.method as PaymentMethod,
    status: payment.status as PaymentStatus,
    amount: toMoney(payment.amountCents, currency),
    pix_copy_paste: payment.pixCopyPaste,
    pix_qr_code: payment.pixQrCode,
    expires_at: iso(payment.expiresAt),
    confirmed_at: iso(payment.confirmedAt),
  };
}

export function toOrderResource(
  order: OrderWithRelations,
  accessToken: string,
): OrderResource {
  const money = (cents: number) => toMoney(cents, order.currency);
  const payment = order.payments[0];

  return {
    id: order.id,
    number: order.number,
    status: order.status as OrderStatus,
    currency: order.currency,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      document: maskCpf(order.customer.document),
      phone: order.customer.phone ?? null,
    },
    shipping_address: {
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2 ?? null,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postal_code: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
    },
    items: order.items.map((item) => {
      const image = item.product?.images[0];
      return {
        id: item.id,
        product_id: item.productId,
        slug: item.product?.slug ?? null,
        image: image
          ? {
              id: image.id,
              url: imageUrl(image),
              alt: image.alt,
              position: image.position,
            }
          : null,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: money(item.unitPriceCents),
        total: money(item.totalCents),
      };
    }),
    coupon: order.coupon ? { code: order.coupon.code } : null,
    subtotal: money(order.subtotalCents),
    discount: money(order.discountCents),
    shipping: money(order.shippingCents),
    total: money(order.totalCents),
    // The payment row is written with the order; it is only shown once the
    // provider created the charge (provider_reference set).
    payment:
      payment && payment.providerReference !== null
        ? toPaymentResource(payment, order.currency)
        : null,
    access_token: accessToken,
    placed_at: iso(order.placedAt),
    paid_at: iso(order.paidAt),
    cancelled_at: iso(order.cancelledAt),
  };
}

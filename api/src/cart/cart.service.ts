import { randomBytes } from 'node:crypto';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { availableQuantity } from '../catalog/catalog.mappers.js';
import { publishedWhere } from '../catalog/published.js';
import { formatMoney } from '../common/money.js';
import type { Env } from '../config/env.js';
import { couponRejection, CouponRejection } from '../coupons/coupon.rules.js';
import {
  DRIZZLE,
  type Database,
  type Transaction,
} from '../database/database.module.js';
import {
  cartItems,
  carts,
  coupons,
  products,
  type Cart,
  type Inventory,
} from '../database/schema.js';
import { toCartResource, type CartResource } from './cart.mappers.js';
import { computeCartTotals } from './cart.rules.js';
import { MAX_LINE_QUANTITY, type AddCartItemDto } from './dto/cart.dto.js';

export const CartStatus = {
  Active: 'active',
  Converted: 'converted',
  Abandoned: 'abandoned',
} as const;

type Db = Database | Transaction;

function unprocessable(message: string, field: string, detail: string) {
  return new UnprocessableEntityException({
    message,
    errors: { [field]: [detail] },
  });
}

/**
 * Guest cart. Identified by an opaque token (`X-Cart-Token`); every use
 * pushes `expires_at` forward. Stock is only *checked* here — it is reserved
 * (with a row lock) by checkout in PROMPT 03.
 * Mutations lock the cart row so concurrent requests on one cart serialize.
 */
@Injectable()
export class CartService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(): Promise<CartResource> {
    const [cart] = await this.db
      .insert(carts)
      .values({
        token: randomBytes(24).toString('base64url'),
        currency: this.config.get('COMMERCE_CURRENCY', { infer: true }),
        status: CartStatus.Active,
        expiresAt: this.nextExpiry(),
      })
      .returning();
    return this.show(cart!.id);
  }

  /**
   * Finds the active, unexpired cart for a token and renews its expiry in one
   * statement. Throws 404 for unknown, expired or already converted carts.
   */
  async resolveByToken(token: string | undefined): Promise<Cart> {
    if (token) {
      const [cart] = await this.db
        .update(carts)
        .set({ expiresAt: this.nextExpiry() })
        .where(
          and(
            eq(carts.token, token),
            eq(carts.status, CartStatus.Active),
            or(isNull(carts.expiresAt), gt(carts.expiresAt, sql`now()`)),
          ),
        )
        .returning();
      if (cart) return cart;
    }
    throw new NotFoundException('Cart not found.');
  }

  async show(cartId: string): Promise<CartResource> {
    const cart = await this.db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: {
        coupon: true,
        items: {
          orderBy: [asc(cartItems.id)],
          with: {
            product: {
              with: {
                images: { orderBy: [asc(sql`position`)], limit: 1 },
                inventory: true,
              },
            },
          },
        },
      },
    });
    if (!cart) throw new NotFoundException('Cart not found.');
    return toCartResource(cart, {
      flatRateCents: this.config.get('SHIPPING_FLAT_RATE_CENTS', {
        infer: true,
      }),
      freeOverCents: this.config.get('SHIPPING_FREE_OVER_CENTS', {
        infer: true,
      }),
    });
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartResource> {
    await this.mutate(cartId, async (tx) => {
      const product = await tx.query.products.findFirst({
        where: and(eq(products.id, dto.product_id), publishedWhere),
        with: { inventory: true },
      });
      if (!product)
        throw unprocessable(
          'Product unavailable.',
          'product_id',
          'Produto indisponível.',
        );

      const existing = await tx.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, product.id),
        ),
      });
      const wanted = (existing?.quantity ?? 0) + dto.quantity;
      this.assertQuantity(wanted, product.inventory);

      // The line always carries the current price: re-adding refreshes the snapshot.
      if (existing) {
        await tx
          .update(cartItems)
          .set({ quantity: wanted, unitPriceCents: product.priceCents })
          .where(eq(cartItems.id, existing.id));
      } else {
        await tx.insert(cartItems).values({
          cartId,
          productId: product.id,
          quantity: wanted,
          unitPriceCents: product.priceCents,
        });
      }
    });
    return this.show(cartId);
  }

  async updateQuantity(
    cartId: string,
    itemId: number,
    quantity: number,
  ): Promise<CartResource> {
    await this.mutate(cartId, async (tx) => {
      const item = await this.findItem(tx, cartId, itemId);
      const product = await tx.query.products.findFirst({
        where: and(eq(products.id, item.productId), publishedWhere),
        with: { inventory: true },
      });
      if (!product)
        throw unprocessable(
          'Product unavailable.',
          'quantity',
          'Produto indisponível. Remova-o do carrinho.',
        );
      this.assertQuantity(quantity, product.inventory);
      await tx
        .update(cartItems)
        .set({ quantity, unitPriceCents: product.priceCents })
        .where(eq(cartItems.id, item.id));
    });
    return this.show(cartId);
  }

  async removeItem(cartId: string, itemId: number): Promise<CartResource> {
    await this.mutate(cartId, async (tx) => {
      const item = await this.findItem(tx, cartId, itemId);
      await tx.delete(cartItems).where(eq(cartItems.id, item.id));
    });
    return this.show(cartId);
  }

  async applyCoupon(cartId: string, code: string): Promise<CartResource> {
    await this.mutate(cartId, async (tx) => {
      const coupon = await tx.query.coupons.findFirst({
        where: eq(sql`upper(${coupons.code})`, code.trim().toUpperCase()),
      });
      if (!coupon)
        throw unprocessable(
          'Coupon not applicable.',
          'code',
          'Cupom inválido.',
        );

      const items = await tx.query.cartItems.findMany({
        where: eq(cartItems.cartId, cartId),
      });
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      );
      const rejection = couponRejection(coupon, subtotal);
      if (rejection) {
        const reasons: Record<CouponRejection, string> = {
          [CouponRejection.Inactive]: 'Cupom inválido.',
          [CouponRejection.NotStarted]: 'Este cupom ainda não está disponível.',
          [CouponRejection.Expired]: 'Este cupom expirou.',
          [CouponRejection.Exhausted]: 'Este cupom atingiu o limite de usos.',
          [CouponRejection.BelowMinimum]: `Pedido mínimo de ${formatMoney(coupon.minSubtotalCents)} para este cupom.`,
        };
        throw unprocessable(
          'Coupon not applicable.',
          'code',
          reasons[rejection],
        );
      }
      await tx
        .update(carts)
        .set({ couponId: coupon.id })
        .where(eq(carts.id, cartId));
    });
    return this.show(cartId);
  }

  async removeCoupon(cartId: string): Promise<CartResource> {
    await this.mutate(cartId, async (tx) => {
      await tx
        .update(carts)
        .set({ couponId: null })
        .where(eq(carts.id, cartId));
    });
    return this.show(cartId);
  }

  /** Runs `work` in a transaction holding the cart row lock, then detaches a coupon that no longer qualifies. */
  private async mutate(
    cartId: string,
    work: (tx: Transaction) => Promise<void>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.id, cartId))
        .for('update');
      await work(tx);
      await this.detachInvalidCoupon(tx, cartId);
    });
  }

  private async detachInvalidCoupon(tx: Db, cartId: string): Promise<void> {
    const cart = await tx.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: { coupon: true, items: true },
    });
    if (!cart?.coupon) return;
    const totals = computeCartTotals({
      items: cart.items,
      coupon: cart.coupon,
      shippingFlatRateCents: 0,
      shippingFreeOverCents: 0,
    });
    if (!totals.couponApplied)
      await tx
        .update(carts)
        .set({ couponId: null })
        .where(eq(carts.id, cartId));
  }

  private async findItem(tx: Db, cartId: string, itemId: number) {
    const item = await tx.query.cartItems.findFirst({
      where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)),
    });
    if (!item) throw new NotFoundException('Cart item not found.');
    return item;
  }

  private assertQuantity(wanted: number, inventory: Inventory | null): void {
    if (wanted > MAX_LINE_QUANTITY)
      throw unprocessable(
        'Insufficient stock.',
        'quantity',
        `Máximo de ${MAX_LINE_QUANTITY} unidades por item.`,
      );
    const available = availableQuantity(inventory);
    if (wanted > available) {
      const detail =
        available === 0
          ? 'Produto esgotado.'
          : available === 1
            ? 'Apenas 1 unidade disponível.'
            : `Apenas ${available} unidades disponíveis.`;
      throw unprocessable('Insufficient stock.', 'quantity', detail);
    }
  }

  private nextExpiry(): Date {
    const days = this.config.get('CART_TTL_DAYS', { infer: true });
    return new Date(Date.now() + days * 86_400_000);
  }
}

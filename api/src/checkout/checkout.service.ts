import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { computeCartTotals } from '../cart/cart.rules.js';
import { CartStatus } from '../cart/cart.service.js';
import type { Env } from '../config/env.js';
import {
  DRIZZLE,
  type Database,
  type Transaction,
} from '../database/database.module.js';
import {
  cartItems,
  carts,
  coupons,
  inventory,
  orderItems,
  orderNumberSeq,
  orders,
  payments,
  products,
  stockMovements,
} from '../database/schema.js';
import { StockMovementType } from '../inventory/stock-movement.js';
import { formatOrderNumber } from '../orders/order-number.js';
import {
  ORDER_PLACED,
  OrderPlacedEvent,
} from '../orders/order-placed.event.js';
import { OrderStatus } from '../orders/order-status.js';
import type { OrderResource } from '../orders/orders.mappers.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentGateway } from '../payments/payment-gateway.js';
import {
  PaymentStatus,
  type ChargeResult,
  type PaymentMethod,
} from '../payments/payment.types.js';
import { describeLineProblem, reviewCartLines } from './checkout.rules.js';
import type { CheckoutDto } from './dto/checkout.dto.js';

export interface PlaceOrderResult {
  order: OrderResource;
  /** false when the Idempotency-Key had already produced this order (HTTP 200 instead of 201). */
  created: boolean;
}

/**
 * Thrown inside the checkout transaction when another request got there
 * first (the cart is no longer active, or the Idempotency-Key was inserted
 * concurrently). Rolls everything back; the caller answers as a replay.
 */
class AlreadyCheckedOut extends Error {}

function unprocessable(message: string, field: string, detail: string) {
  return new UnprocessableEntityException({
    message,
    errors: { [field]: [detail] },
  });
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
    private readonly gateway: PaymentGateway,
    private readonly orders: OrdersService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Cart → order. Same Idempotency-Key + same cart → the same order, whatever
   * happened in between (including a crash between reserving and charging).
   */
  async placeOrder(
    cartToken: string | undefined,
    idempotencyKey: string,
    dto: CheckoutDto,
  ): Promise<PlaceOrderResult> {
    if (!this.gateway.methods.includes(dto.payment_method))
      throw unprocessable(
        'Payment method not available.',
        'payment_method',
        'Forma de pagamento indisponível.',
      );

    const previous = await this.replay(idempotencyKey, cartToken);
    if (previous) return previous;

    let orderId: string;
    try {
      orderId = await this.reserveAndCreateOrder(
        cartToken,
        idempotencyKey,
        dto,
      );
    } catch (error) {
      if (!(error instanceof AlreadyCheckedOut)) throw error;
      const replayed = await this.replay(idempotencyKey, cartToken);
      if (replayed) return replayed;
      // Converted by a checkout with another key: the cart is gone for good.
      throw new NotFoundException('Cart not found.');
    }

    await this.charge(orderId);
    return { order: await this.orders.resource(orderId), created: true };
  }

  /** The order already created with this key, after making sure it has a charge. */
  private async replay(
    idempotencyKey: string,
    cartToken: string | undefined,
  ): Promise<PlaceOrderResult | null> {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.idempotencyKey, idempotencyKey),
      columns: { id: true },
      with: { cart: { columns: { token: true } } },
    });
    if (!order) return null;
    // A key belongs to one cart; reusing it elsewhere must not leak that order.
    if (!cartToken || order.cart?.token !== cartToken)
      throw unprocessable(
        'Idempotency-Key already used.',
        'idempotency_key',
        'Esta chave já foi usada em outro pedido.',
      );
    await this.charge(order.id);
    return { order: await this.orders.resource(order.id), created: false };
  }

  /**
   * One transaction, short and without network calls: lock the cart, lock the
   * inventory rows (product id order, so concurrent checkouts queue instead of
   * deadlocking), re-validate, reserve, create order + items + pending
   * payment, convert the cart. Returns the order id.
   */
  private async reserveAndCreateOrder(
    cartToken: string | undefined,
    idempotencyKey: string,
    dto: CheckoutDto,
  ): Promise<string> {
    if (!cartToken) throw new NotFoundException('Cart not found.');
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [cart] = await tx
        .select()
        .from(carts)
        .where(eq(carts.token, cartToken))
        .for('update');
      if (!cart) throw new NotFoundException('Cart not found.');
      if (cart.status !== CartStatus.Active) throw new AlreadyCheckedOut();
      if (cart.expiresAt !== null && cart.expiresAt <= now)
        throw new NotFoundException('Cart not found.');

      const lines = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.productId));
      if (lines.length === 0)
        throw unprocessable(
          'Cart is empty.',
          'cart',
          'Seu carrinho está vazio.',
        );

      const productIds = lines.map((line) => line.productId);
      const stock = await tx
        .select()
        .from(inventory)
        .where(inArray(inventory.productId, productIds))
        .orderBy(asc(inventory.productId))
        .for('update');
      const live = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      const review = reviewCartLines(
        lines,
        new Map(live.map((product) => [product.id, product])),
        new Map(stock.map((row) => [row.productId, row])),
        now,
      );
      if (review.problems.length > 0)
        throw new UnprocessableEntityException({
          message: 'Some items are no longer available.',
          errors: { items: review.problems.map(describeLineProblem) },
          unavailable: review.problems.map((problem) => ({
            product_id: problem.productId,
            name: problem.name,
            requested: problem.requested,
            available: problem.available,
            reason: problem.reason,
          })),
        });

      // The order charges the live price; the cart snapshot follows it.
      for (const line of review.lines.filter((l) => l.priceChanged))
        await tx
          .update(cartItems)
          .set({ unitPriceCents: line.unitPriceCents })
          .where(
            and(
              eq(cartItems.cartId, cart.id),
              eq(cartItems.productId, line.productId),
            ),
          );

      // Locked so concurrent checkouts cannot overrun max_uses. A coupon that
      // stopped qualifying is dropped, exactly as GET /cart already shows it.
      const [coupon] =
        cart.couponId === null
          ? []
          : await tx
              .select()
              .from(coupons)
              .where(eq(coupons.id, cart.couponId))
              .for('update');
      const totals = computeCartTotals({
        items: review.lines,
        coupon: coupon ?? null,
        shippingFlatRateCents: this.config.get('SHIPPING_FLAT_RATE_CENTS', {
          infer: true,
        }),
        shippingFreeOverCents: this.config.get('SHIPPING_FREE_OVER_CENTS', {
          infer: true,
        }),
        at: now,
      });
      if (coupon && totals.couponApplied)
        await tx
          .update(coupons)
          .set({ uses: sql`${coupons.uses} + 1` })
          .where(eq(coupons.id, coupon.id));

      const number = formatOrderNumber(
        this.config.get('ORDER_NUMBER_PREFIX', { infer: true }),
        now,
        await this.nextOrderSequence(tx),
      );
      const [order] = await tx
        .insert(orders)
        .values({
          number,
          cartId: cart.id,
          userId: cart.userId,
          couponId: totals.couponApplied ? (coupon?.id ?? null) : null,
          status: OrderStatus.PendingPayment,
          currency: cart.currency,
          customer: {
            name: dto.customer.name,
            email: dto.customer.email,
            document: dto.customer.document,
            phone: dto.customer.phone,
          },
          shippingAddress: {
            line1: dto.shipping_address.line1,
            line2: dto.shipping_address.line2,
            city: dto.shipping_address.city,
            state: dto.shipping_address.state,
            postalCode: dto.shipping_address.postal_code,
            country: dto.shipping_address.country,
          },
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          idempotencyKey,
          placedAt: now,
        })
        // Same key, different cart, at the same moment: the unique index makes
        // the loser wait for the winner's commit, then insert nothing.
        .onConflictDoNothing({ target: orders.idempotencyKey })
        .returning();
      if (!order) throw new AlreadyCheckedOut();

      await tx.insert(orderItems).values(
        review.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.quantity * line.unitPriceCents,
        })),
      );

      // Rows are locked: this cannot oversell, and the CHECK
      // (0 <= reserved <= quantity) backs it up at the database level.
      for (const line of review.lines)
        await tx
          .update(inventory)
          .set({ reserved: sql`${inventory.reserved} + ${line.quantity}` })
          .where(eq(inventory.productId, line.productId));
      await tx.insert(stockMovements).values(
        review.lines.map((line) => ({
          productId: line.productId,
          type: StockMovementType.Reserved,
          quantity: line.quantity,
          referenceType: 'order',
          referenceId: order.id,
        })),
      );

      // Pending until the provider answers (after commit). Its expiry lets the
      // unpaid-order sweeper (PROMPT 04) release the stock even if the charge
      // never gets created.
      const ttlMinutes = this.config.get('ORDER_PAYMENT_TTL_MINUTES', {
        infer: true,
      });
      await tx.insert(payments).values({
        orderId: order.id,
        provider: this.gateway.name,
        method: dto.payment_method,
        status: PaymentStatus.Pending,
        amountCents: order.totalCents,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
      });

      await tx
        .update(carts)
        .set({ status: CartStatus.Converted })
        .where(eq(carts.id, cart.id));

      return order.id;
    });
  }

  private async nextOrderSequence(tx: Transaction): Promise<number> {
    const result = await tx.execute<{ value: string | number }>(
      sql`select nextval(${orderNumberSeq.seqName}) as value`,
    );
    return Number(result.rows[0]!.value);
  }

  /**
   * Creates the charge at the provider for a pending order whose payment has
   * none yet: right after the transaction, or on a replay after the provider
   * failed. Network I/O stays outside every transaction.
   */
  private async charge(orderId: string): Promise<void> {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        payments: {
          orderBy: (payment, { desc }) => [desc(payment.createdAt)],
          limit: 1,
        },
      },
    });
    const payment = order?.payments[0];
    if (
      !order ||
      order.status !== OrderStatus.PendingPayment ||
      !payment ||
      payment.providerReference !== null
    )
      return;

    let charge: ChargeResult;
    try {
      // The payment id doubles as the provider's idempotency key: racing
      // replays reach the same charge instead of creating a second one.
      charge = await this.gateway.charge(
        order,
        payment.method as PaymentMethod,
        payment.id,
      );
    } catch (error) {
      this.logger.error(
        `Order ${order.number}: charge failed at ${this.gateway.name}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException(
        'Payment provider unavailable. Retry with the same Idempotency-Key.',
      );
    }

    // Racing replays got the same charge back; only the first write announces the order.
    const [stored] = await this.db
      .update(payments)
      .set({
        providerReference: charge.providerReference,
        pixQrCode: charge.pixQrCode,
        pixCopyPaste: charge.pixCopyPaste,
        expiresAt: charge.expiresAt ?? payment.expiresAt,
        payload: charge.payload,
      })
      .where(
        and(eq(payments.id, payment.id), isNull(payments.providerReference)),
      )
      .returning({ id: payments.id });
    if (stored) this.events.emit(ORDER_PLACED, new OrderPlacedEvent(order.id));
  }
}

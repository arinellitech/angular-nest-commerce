import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module.js';
import { orders } from '../database/schema.js';
import { OrderLinks } from './order-links.js';
import { toOrderResource, type OrderResource } from './orders.mappers.js';

export interface OrderCredentials {
  /** X-Cart-Token of the cart the order was placed from. */
  cartToken?: string;
  /** Signed token from the e-mail link (`?token=`). */
  accessToken?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly links: OrderLinks,
  ) {}

  /**
   * GET /orders/{number}. Readable with the token of the originating cart or
   * with the signed link token; the owner's JWT joins in PROMPT 05.
   * Every failure is a 404, so sequential order numbers cannot be probed.
   */
  async findAccessible(
    number: string,
    credentials: OrderCredentials,
  ): Promise<OrderResource> {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.number, number),
      columns: { id: true },
      with: { cart: { columns: { token: true } } },
    });
    if (!order || !this.canRead(order, credentials))
      throw new NotFoundException('Order not found.');
    return this.resource(order.id);
  }

  async resource(orderId: string): Promise<OrderResource> {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        coupon: true,
        items: {
          orderBy: (item, { asc }) => [asc(item.id)],
          with: {
            product: {
              with: {
                images: {
                  orderBy: (image, { asc }) => [asc(image.position)],
                  limit: 1,
                },
              },
            },
          },
        },
        payments: {
          orderBy: (payment, { desc }) => [desc(payment.createdAt)],
          limit: 1,
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return toOrderResource(order, this.links.token(order.id));
  }

  private canRead(
    order: { id: string; cart: { token: string } | null },
    { cartToken, accessToken }: OrderCredentials,
  ): boolean {
    if (accessToken && this.links.verify(order.id, accessToken)) return true;
    return Boolean(cartToken) && order.cart?.token === cartToken;
  }
}

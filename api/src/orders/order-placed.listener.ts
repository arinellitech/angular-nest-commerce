import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Mailer } from '../mail/mailer.js';
import { renderOrderPlacedEmail } from './order-email.js';
import { OrderLinks } from './order-links.js';
import { ORDER_PLACED, OrderPlacedEvent } from './order-placed.event.js';
import { OrdersService } from './orders.service.js';

/**
 * Sends the "pedido recebido" e-mail. Runs after the HTTP response (async
 * listener) and never fails the checkout: a mail error is logged. Retries
 * come with the job queue in PROMPT 04.
 */
@Injectable()
export class OrderPlacedListener {
  private readonly logger = new Logger(OrderPlacedListener.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly links: OrderLinks,
    private readonly mailer: Mailer,
  ) {}

  @OnEvent(ORDER_PLACED, { async: true, promisify: true })
  async handle(event: OrderPlacedEvent): Promise<void> {
    try {
      const order = await this.orders.resource(event.orderId);
      const mail = renderOrderPlacedEmail(order, this.links.pageUrl(order));
      await this.mailer.send({ to: order.customer.email, ...mail });
      this.logger.log(`Order ${order.number}: confirmation e-mail sent`);
    } catch (error) {
      this.logger.error(
        `Order ${event.orderId}: confirmation e-mail failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

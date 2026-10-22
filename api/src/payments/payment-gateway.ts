import type { Request } from 'express';
import type { Order } from '../database/schema.js';
import type {
  ChargeResult,
  PaymentMethod,
  WebhookResult,
} from './payment.types.js';

/**
 * Every provider (mock, Asaas, Pagar.me, Stripe...) implements this contract.
 * Checkout only depends on the abstract class (used as the DI token);
 * PaymentsModule picks the implementation from PAYMENT_PROVIDER.
 */
export abstract class PaymentGateway {
  abstract readonly name: string;

  /** Create a charge for the order. Must not persist anything — the caller does, in its transaction. */
  abstract charge(order: Order, method: PaymentMethod): Promise<ChargeResult>;

  /**
   * Verify the webhook signature and translate the provider payload into a
   * normalized result. Side-effect free: persistence happens in the webhook
   * handler after the event is recorded for idempotency.
   */
  abstract parseWebhook(request: Request): Promise<WebhookResult>;
}

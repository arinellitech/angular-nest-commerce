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

  /** Payment methods this provider can charge; checkout rejects the others with 422. */
  abstract readonly methods: readonly PaymentMethod[];

  /**
   * Create a charge for the order. Must not persist anything — the caller does.
   * `idempotencyKey` (our payment id) must be forwarded to the provider so a
   * retried or concurrent call returns the same charge instead of a second one.
   */
  abstract charge(
    order: Order,
    method: PaymentMethod,
    idempotencyKey: string,
  ): Promise<ChargeResult>;

  /**
   * Verify the webhook signature and translate the provider payload into a
   * normalized result. Side-effect free: persistence happens in the webhook
   * handler after the event is recorded for idempotency.
   */
  abstract parseWebhook(request: Request): Promise<WebhookResult>;
}

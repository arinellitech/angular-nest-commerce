import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { Order } from '../database/schema.js';
import { PaymentGateway } from './payment-gateway.js';
import {
  PaymentMethod,
  PaymentStatus,
  type ChargeResult,
  type WebhookResult,
} from './payment.types.js';

/**
 * Local/demo provider. Generates a fake Pix "copia e cola" and confirms when
 * POST /api/v1/webhooks/mock is called with the shared secret.
 * Behaves like a real PSP so the checkout flow is exercised end-to-end.
 */
@Injectable()
export class MockGateway extends PaymentGateway {
  readonly name = 'mock';

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async charge(order: Order, method: PaymentMethod): Promise<ChargeResult> {
    const ttl = this.config.get('ORDER_PAYMENT_TTL_MINUTES', { infer: true });
    const reference = `mock_${randomUUID().replace(/-/g, '')}`;

    return {
      provider: this.name,
      method,
      providerReference: reference,
      pixCopyPaste:
        method === PaymentMethod.Pix
          ? `00020126580014br.gov.bcb.pix0136${randomUUID()}5204000053039865802BR5913Loja Demo6009Sao Paulo62070503***6304MOCK`
          : null,
      pixQrCode: null, // storefront renders the copy-paste string as a QR code
      expiresAt: new Date(Date.now() + ttl * 60_000),
      payload: { order: order.number },
    };
  }

  async parseWebhook(request: Request): Promise<WebhookResult> {
    const secret = this.config.get('PAYMENT_WEBHOOK_SECRET', { infer: true });
    const provided = String(request.header('x-webhook-secret') ?? '');

    if (
      provided.length !== secret.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
    ) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const body = request.body as {
      id?: unknown;
      type?: unknown;
      reference?: unknown;
    };
    const statusByType: Record<string, PaymentStatus> = {
      'payment.confirmed': PaymentStatus.Confirmed,
      'payment.failed': PaymentStatus.Failed,
      'payment.refunded': PaymentStatus.Refunded,
    };

    if (
      typeof body.id !== 'string' ||
      typeof body.reference !== 'string' ||
      typeof body.type !== 'string' ||
      !(body.type in statusByType)
    ) {
      throw new UnprocessableEntityException({
        message: 'Validation failed.',
        errors: {
          type: [
            'must be payment.confirmed | payment.failed | payment.refunded',
          ],
          id: ['required'],
          reference: ['required'],
        },
      });
    }

    return {
      externalId: body.id,
      type: body.type,
      providerReference: body.reference,
      status: statusByType[body.type]!,
      payload: request.body as Record<string, unknown>,
    };
  }
}

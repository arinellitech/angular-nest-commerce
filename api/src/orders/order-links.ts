import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** HMAC-SHA256 of the order id, base64url. Stateless: no table, no expiry. */
export function signOrderToken(secret: string, orderId: string): string {
  return createHmac('sha256', secret)
    .update(`order-access:${orderId}`)
    .digest('base64url');
}

export function verifyOrderToken(
  secret: string,
  orderId: string,
  token: string,
): boolean {
  const expected = Buffer.from(signOrderToken(secret, orderId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Signed links to the order page, for customers without the original cart
 * (e-mail, another device). Signing uses ORDER_LINK_SECRET; outside
 * production a random key is generated per boot when it is unset.
 */
@Injectable()
export class OrderLinks {
  private readonly secret: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService<Env, true>) {
    const secret = config.get('ORDER_LINK_SECRET', { infer: true });
    if (!secret)
      new Logger(OrderLinks.name).warn(
        'ORDER_LINK_SECRET is not set: using a random key, order links stop working after a restart.',
      );
    this.secret = secret ?? randomBytes(32).toString('base64url');
    this.frontendUrl = config
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/+$/, '');
  }

  token(orderId: string): string {
    return signOrderToken(this.secret, orderId);
  }

  verify(orderId: string, token: string): boolean {
    return verifyOrderToken(this.secret, orderId, token);
  }

  /** Storefront order page with the access token, as sent by e-mail. */
  pageUrl(order: { id: string; number: string }): string {
    return `${this.frontendUrl}/orders/${encodeURIComponent(order.number)}?token=${this.token(order.id)}`;
  }
}

import { HttpClient, httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { CheckoutPayload, Order, Single } from './types';

/**
 * POST /checkout (api/docs/api.md → "Checkout & orders"). The cart token is
 * attached by `apiInterceptor`; the Idempotency-Key is the caller's: one per
 * checkout attempt, resent unchanged on every retry. `cartToken` is only
 * passed when recovering an attempt whose cart the browser already forgot.
 */
@Service()
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  place(payload: CheckoutPayload, idempotencyKey: string, cartToken?: string) {
    return this.http.post<Single<Order>>('/api/v1/checkout', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
        ...(cartToken ? { 'X-Cart-Token': cartToken } : {}),
      },
    });
  }
}

/**
 * GET /orders/{number}. `token` is the signed access token from the order URL
 * (e-mail link, or the redirect after checkout); without it the API falls back
 * to the cart token header. Call in an injection context.
 */
export function orderResource(number: () => string | undefined, token: () => string | undefined) {
  return httpResource<Single<Order>>(() => {
    const value = number();
    if (!value) return undefined;
    const access = token();
    const params: Record<string, string> = access ? { token: access } : {};
    return { url: `/api/v1/orders/${encodeURIComponent(value)}`, params };
  });
}

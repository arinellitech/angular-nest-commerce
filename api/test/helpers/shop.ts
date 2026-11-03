import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** A valid POST /checkout body (with the punctuation a form would send). */
export function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      name: 'Ana Souza',
      email: ' Ana.Souza@Example.com ',
      document: '529.982.247-25',
      phone: '(11) 98765-4321',
    },
    shipping_address: {
      line1: 'Av. Paulista, 1000',
      line2: 'Apto 12',
      city: 'São Paulo',
      state: 'sp',
      postal_code: '01310-100',
    },
    payment_method: 'pix',
    ...overrides,
  };
}

/** Drives the public API like the storefront does: cart first, then checkout. */
export function shop(app: INestApplication) {
  const http = () => request(app.getHttpServer());

  return {
    http,

    /** New guest cart with `[productId, quantity]` lines (and a coupon); returns its token. */
    async cart(
      lines: [productId: number, quantity: number][],
      couponCode?: string,
    ): Promise<string> {
      const created = await http().post('/api/v1/cart').expect(201);
      const token = created.body.data.token as string;
      for (const [product_id, quantity] of lines)
        await http()
          .post('/api/v1/cart/items')
          .set('X-Cart-Token', token)
          .send({ product_id, quantity })
          .expect(201);
      if (couponCode)
        await http()
          .post('/api/v1/cart/coupon')
          .set('X-Cart-Token', token)
          .send({ code: couponCode })
          .expect(200);
      return token;
    },

    checkout(
      token: string | null,
      key: string | null = randomUUID(),
      body: object = checkoutBody(),
    ) {
      const req = http().post('/api/v1/checkout');
      if (token !== null) req.set('X-Cart-Token', token);
      if (key !== null) req.set('Idempotency-Key', key);
      return req.send(body);
    },

    order(number: string, credentials: { cartToken?: string; token?: string }) {
      const req = http().get(`/api/v1/orders/${number}`);
      if (credentials.cartToken) req.set('X-Cart-Token', credentials.cartToken);
      if (credentials.token) req.query({ token: credentials.token });
      return req;
    },
  };
}

import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/database/database.module.js';
import { createTestApp } from './helpers/app.js';
import { factories } from './helpers/factories.js';
import type { InMemoryMailer } from './helpers/in-memory.mailer.js';
import { shop } from './helpers/shop.js';

describe('GET /orders/{number}', () => {
  let app: INestApplication;
  let mailer: InMemoryMailer;
  let api: ReturnType<typeof shop>;
  let cartToken: string;
  let order: { id: string; number: string; access_token: string };

  beforeAll(async () => {
    let db: Database;
    ({ app, db, mailer } = await createTestApp());
    api = shop(app);
    const product = await factories(db).product({ priceCents: 5000 });
    cartToken = await api.cart([[product.id, 1]]);
    order = (await api.checkout(cartToken).expect(201)).body.data;
  });

  afterAll(() => app.close());

  it('is readable with the X-Cart-Token of the originating cart, never cached', async () => {
    const res = await api.order(order.number, { cartToken }).expect(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.data).toMatchObject({
      id: order.id,
      number: order.number,
      status: 'pending_payment',
      customer: { document: '***.982.247-**' },
      payment: { method: 'pix', pix_copy_paste: expect.any(String) },
    });
  });

  it('is readable with the signed token, as linked in the e-mail', async () => {
    await vi.waitFor(() => expect(mailer.outbox).toHaveLength(1));
    const link = mailer.outbox[0]!.text.match(/https?:\/\/\S+/)![0];
    const token = new URL(link).searchParams.get('token')!;
    expect(token).toBe(order.access_token);

    const res = await api.order(order.number, { token }).expect(200);
    expect(res.body.data.id).toBe(order.id);
  });

  it('answers 404 without a valid credential, so numbers cannot be probed', async () => {
    await api.order(order.number, {}).expect(404);
    await api.order(order.number, { token: 'forjado' }).expect(404);
    await api
      .order(order.number, { token: `${order.access_token.slice(0, -2)}xx` })
      .expect(404);

    const otherCart = (await api.http().post('/api/v1/cart').expect(201)).body
      .data.token as string;
    await api.order(order.number, { cartToken: otherCart }).expect(404);
  });

  it('answers 404 for an unknown number, even with a token from another order', async () => {
    await api
      .order('ORD-2026-999999', { token: order.access_token, cartToken })
      .expect(404);
  });
});

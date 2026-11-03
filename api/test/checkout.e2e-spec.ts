import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.module.js';
import {
  cartItems,
  carts,
  coupons,
  inventory,
  orderItems,
  orders,
  products,
  stockMovements,
} from '../src/database/schema.js';
import { PaymentGateway } from '../src/payments/payment-gateway.js';
import { createTestApp } from './helpers/app.js';
import { factories } from './helpers/factories.js';
import type { InMemoryMailer } from './helpers/in-memory.mailer.js';
import { checkoutBody, shop } from './helpers/shop.js';

describe('checkout', () => {
  let app: INestApplication;
  let db: Database;
  let mailer: InMemoryMailer;
  let make: ReturnType<typeof factories>;
  let api: ReturnType<typeof shop>;

  const stockOf = async (productId: number) =>
    (await db.query.inventory.findFirst({
      where: eq(inventory.productId, productId),
    }))!;
  const cartOf = async (token: string) =>
    (await db.query.carts.findFirst({ where: eq(carts.token, token) }))!;

  beforeAll(async () => {
    ({ app, db, mailer } = await createTestApp());
    make = factories(db);
    api = shop(app);
  });

  afterAll(() => app.close());

  describe('POST /checkout', () => {
    it('turns the cart into an order, reserves stock and creates a Pix charge', async () => {
      const keyboard = await make.product({
        name: 'Teclado Mecânico',
        priceCents: 4000,
        stock: 10,
        images: 1,
      });
      const mouse = await make.product({ priceCents: 2500, stock: 3 });
      const token = await api.cart([
        [keyboard.id, 2],
        [mouse.id, 1],
      ]);

      const res = await api.checkout(token).expect(201);
      const order = res.body.data;

      expect(order).toMatchObject({
        number: expect.stringMatching(/^ORD-\d{4}-\d{6}$/),
        status: 'pending_payment',
        currency: 'BRL',
        customer: {
          name: 'Ana Souza',
          email: 'ana.souza@example.com',
          document: '***.982.247-**',
          phone: '11987654321',
        },
        shipping_address: {
          line1: 'Av. Paulista, 1000',
          line2: 'Apto 12',
          city: 'São Paulo',
          state: 'SP',
          postal_code: '01310100',
          country: 'BR',
        },
        coupon: null,
        subtotal: { amount: 10_500 },
        discount: { amount: 0 },
        shipping: { amount: 1990 },
        total: { amount: 12_490 },
        payment: {
          provider: 'mock',
          method: 'pix',
          status: 'pending',
          amount: { amount: 12_490 },
          pix_copy_paste: expect.stringContaining('br.gov.bcb.pix'),
          expires_at: expect.any(String),
          confirmed_at: null,
        },
        access_token: expect.any(String),
        placed_at: expect.any(String),
        paid_at: null,
      });
      expect(order.items).toEqual([
        expect.objectContaining({
          product_id: keyboard.id,
          slug: keyboard.slug,
          name: 'Teclado Mecânico',
          sku: keyboard.sku,
          quantity: 2,
          unit_price: expect.objectContaining({ amount: 4000 }),
          total: expect.objectContaining({ amount: 8000 }),
          image: expect.objectContaining({ url: expect.any(String) }),
        }),
        expect.objectContaining({ product_id: mouse.id, quantity: 1 }),
      ]);

      expect(await stockOf(keyboard.id)).toMatchObject({
        quantity: 10,
        reserved: 2,
      });
      expect(await stockOf(mouse.id)).toMatchObject({
        quantity: 3,
        reserved: 1,
      });
      const movements = await db.query.stockMovements.findMany({
        where: eq(stockMovements.referenceId, order.id),
      });
      expect(movements).toHaveLength(2);
      expect(movements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: keyboard.id,
            type: 'reserved',
            quantity: 2,
            referenceType: 'order',
          }),
        ]),
      );

      // The CPF is stored in full (digits only) for invoicing, masked in the API.
      const row = await db.query.orders.findFirst({
        where: eq(orders.id, order.id),
      });
      expect(row!.customer.document).toBe('52998224725');

      expect((await cartOf(token)).status).toBe('converted');
      await api
        .http()
        .get('/api/v1/cart')
        .set('X-Cart-Token', token)
        .expect(404);
    });

    it('lowers available_quantity on the product page', async () => {
      const product = await make.product({ stock: 5 });
      const token = await api.cart([[product.id, 2]]);
      await api.checkout(token).expect(201);

      const res = await api
        .http()
        .get(`/api/v1/products/${product.slug}`)
        .expect(200);
      expect(res.body.data).toMatchObject({
        available_quantity: 3,
        in_stock: true,
      });
    });

    it('e-mails the customer a summary with a signed link to the order', async () => {
      const product = await make.product({ name: 'Fone Bluetooth' });
      const token = await api.cart([[product.id, 1]]);
      const sentBefore = mailer.outbox.length;

      const { body } = await api.checkout(token).expect(201);
      await vi.waitFor(() =>
        expect(mailer.outbox).toHaveLength(sentBefore + 1),
      );

      const mail = mailer.outbox.at(-1)!;
      expect(mail.to).toBe('ana.souza@example.com');
      expect(mail.subject).toBe(`Pedido ${body.data.number} recebido`);
      expect(mail.text).toContain('Fone Bluetooth');
      expect(mail.text).toContain(body.data.payment.pix_copy_paste);
      expect(mail.text).toContain(
        `http://localhost:4200/orders/${body.data.number}?token=${body.data.access_token}`,
      );
    });

    it('numbers orders from the sequence, one after the other', async () => {
      const product = await make.product({ stock: 10 });
      const first = await api.checkout(await api.cart([[product.id, 1]]));
      const second = await api.checkout(await api.cart([[product.id, 1]]));
      const seq = (number: string) => Number(number.split('-')[2]);
      expect(seq(second.body.data.number)).toBe(
        seq(first.body.data.number) + 1,
      );
    });
  });

  describe('Idempotency-Key', () => {
    it('returns the same order with 200 when the key is resent, without reserving twice', async () => {
      const product = await make.product({ stock: 5 });
      const token = await api.cart([[product.id, 2]]);
      const key = randomUUID();
      const sentBefore = mailer.outbox.length;

      const first = await api.checkout(token, key).expect(201);
      const again = await api.checkout(token, key).expect(200);
      const third = await api.checkout(token, key.toUpperCase()).expect(200);

      expect(again.body.data).toEqual(first.body.data);
      expect(third.body.data.id).toBe(first.body.data.id);
      expect(await stockOf(product.id)).toMatchObject({ reserved: 2 });
      expect(
        await db.query.orders.findMany({
          where: eq(orders.idempotencyKey, key),
        }),
      ).toHaveLength(1);
      await vi.waitFor(() =>
        expect(mailer.outbox).toHaveLength(sentBefore + 1),
      );
    });

    it('rejects a key already used by another cart', async () => {
      const product = await make.product();
      const key = randomUUID();
      await api.checkout(await api.cart([[product.id, 1]]), key).expect(201);

      const other = await api.cart([[product.id, 1]]);
      const res = await api.checkout(other, key).expect(422);
      expect(res.body.errors.idempotency_key).toHaveLength(1);
      expect((await cartOf(other)).status).toBe('active');
    });

    it('requires the header and a UUID', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      await api.checkout(token, null).expect(400);
      const res = await api.checkout(token, 'pedido-1').expect(400);
      expect(res.body.message).toContain('Idempotency-Key');
      expect((await cartOf(token)).status).toBe('active');
    });

    it('keeps the order when the provider fails and charges it on retry with the same key', async () => {
      const gateway = app.get(PaymentGateway);
      const spy = vi
        .spyOn(gateway, 'charge')
        .mockRejectedValueOnce(new Error('PSP timeout'));
      const product = await make.product({ stock: 4 });
      const token = await api.cart([[product.id, 1]]);
      const key = randomUUID();
      const sentBefore = mailer.outbox.length;

      const failed = await api.checkout(token, key).expect(502);
      expect(failed.body.message).toContain('same Idempotency-Key');
      expect(await stockOf(product.id)).toMatchObject({ reserved: 1 });
      const pending = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, key),
        with: { payments: true },
      });
      expect(pending!.payments).toHaveLength(1);
      expect(pending!.payments[0]!.providerReference).toBeNull();
      expect(mailer.outbox).toHaveLength(sentBefore);

      const retried = await api.checkout(token, key).expect(200);
      expect(retried.body.data.number).toBe(pending!.number);
      expect(retried.body.data.payment.pix_copy_paste).toEqual(
        expect.any(String),
      );
      expect(await stockOf(product.id)).toMatchObject({ reserved: 1 });
      await vi.waitFor(() =>
        expect(mailer.outbox).toHaveLength(sentBefore + 1),
      );
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('stock', () => {
    it('sells the last unit once: the second checkout gets 422 with the product', async () => {
      const product = await make.product({ name: 'Último Monitor', stock: 1 });
      // Both carts hold the unit: the cart only checks stock, checkout reserves it.
      const first = await api.cart([[product.id, 1]]);
      const second = await api.cart([[product.id, 1]]);

      await api.checkout(first).expect(201);
      const res = await api.checkout(second).expect(422);

      expect(res.body.errors.items).toEqual(['Último Monitor está esgotado.']);
      expect(res.body.unavailable).toEqual([
        {
          product_id: product.id,
          name: 'Último Monitor',
          requested: 1,
          available: 0,
          reason: 'insufficient_stock',
        },
      ]);
      expect(await stockOf(product.id)).toMatchObject({
        quantity: 1,
        reserved: 1,
      });
      expect((await cartOf(second)).status).toBe('active');
    });

    it('reports every unavailable line at once and changes nothing', async () => {
      const scarce = await make.product({ name: 'Cadeira', stock: 3 });
      const leaving = await make.product({ name: 'Luminária' });
      const fine = await make.product({ stock: 10 });
      const token = await api.cart([
        [scarce.id, 3],
        [leaving.id, 1],
        [fine.id, 1],
      ]);
      await db
        .update(inventory)
        .set({ reserved: 2 })
        .where(eq(inventory.productId, scarce.id));
      await db
        .update(products)
        .set({ publishedAt: null })
        .where(eq(products.id, leaving.id));

      const res = await api.checkout(token).expect(422);
      expect(res.body.errors.items).toEqual([
        'Cadeira: apenas 1 unidade disponível.',
        'Luminária não está mais disponível.',
      ]);
      expect(
        res.body.unavailable.map((u: { reason: string }) => u.reason),
      ).toEqual(['insufficient_stock', 'unavailable']);
      expect(await stockOf(fine.id)).toMatchObject({ reserved: 0 });
      expect((await cartOf(token)).status).toBe('active');
    });
  });

  describe('prices and coupons', () => {
    it('charges the live price when it changed and refreshes the cart snapshot', async () => {
      const product = await make.product({ priceCents: 10_000 });
      const token = await api.cart([[product.id, 2]]);
      await db
        .update(products)
        .set({ priceCents: 12_000 })
        .where(eq(products.id, product.id));

      const res = await api.checkout(token).expect(201);
      expect(res.body.data.items[0].unit_price.amount).toBe(12_000);
      expect(res.body.data.subtotal.amount).toBe(24_000);

      const cart = await cartOf(token);
      const line = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, product.id),
        ),
      });
      expect(line!.unitPriceCents).toBe(12_000);
    });

    it('applies the cart coupon and counts one use', async () => {
      const coupon = await make.coupon({
        code: 'BEMVINDO10',
        value: 10,
        minSubtotalCents: 5000,
      });
      const product = await make.product({ priceCents: 4000 });
      const token = await api.cart([[product.id, 2]], 'bemvindo10');

      const res = await api.checkout(token).expect(201);
      expect(res.body.data).toMatchObject({
        coupon: { code: 'BEMVINDO10' },
        subtotal: { amount: 8000 },
        discount: { amount: 800 },
        shipping: { amount: 1990 },
        total: { amount: 9190 },
      });
      const after = await db.query.coupons.findFirst({
        where: eq(coupons.id, coupon.id),
      });
      expect(after!.uses).toBe(1);
    });

    it('drops a coupon that stopped qualifying before checkout, as the cart total shows', async () => {
      const coupon = await make.coupon({ maxUses: 1 });
      const product = await make.product({ priceCents: 6000 });
      const token = await api.cart([[product.id, 1]], coupon.code);
      await db
        .update(coupons)
        .set({ uses: 1 })
        .where(eq(coupons.id, coupon.id));

      const res = await api.checkout(token).expect(201);
      expect(res.body.data).toMatchObject({
        coupon: null,
        discount: { amount: 0 },
        total: { amount: 6000 + 1990 },
      });
      const after = await db.query.coupons.findFirst({
        where: eq(coupons.id, coupon.id),
      });
      expect(after!.uses).toBe(1);
    });
  });

  describe('errors', () => {
    it('returns 404 without a cart token, with an unknown one and for an expired cart', async () => {
      await api.checkout(null).expect(404);
      await api.checkout('nao-existe').expect(404);

      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      await db
        .update(carts)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(carts.token, token));
      await api.checkout(token).expect(404);
    });

    it('returns 404 for a cart converted by a checkout with another key', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      await api.checkout(token).expect(201);
      await api.checkout(token).expect(404);
    });

    it('returns 422 on cart for an empty cart', async () => {
      const token = await api.cart([]);
      const res = await api.checkout(token).expect(422);
      expect(res.body.errors.cart).toEqual(['Seu carrinho está vazio.']);
    });

    it('validates customer, address and payment method with field paths', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      const res = await api
        .checkout(
          token,
          randomUUID(),
          checkoutBody({
            customer: {
              name: 'A',
              email: 'nao-e-email',
              document: '529.982.247-24',
              phone: '1234',
            },
            shipping_address: {
              line1: '',
              city: 'São Paulo',
              state: 'XX',
              postal_code: '01310-10',
              country: 'AR',
            },
            payment_method: 'cheque',
          }),
        )
        .expect(422);

      expect(Object.keys(res.body.errors).sort()).toEqual([
        'customer.document',
        'customer.email',
        'customer.name',
        'customer.phone',
        'payment_method',
        'shipping_address.country',
        'shipping_address.line1',
        'shipping_address.postal_code',
        'shipping_address.state',
      ]);
      expect(res.body.errors['customer.document']).toEqual(['CPF inválido.']);
      expect(res.body.errors['shipping_address.postal_code']).toEqual([
        'CEP deve ter 8 dígitos.',
      ]);
    });

    it('rejects arrays or empty objects for customer and address, before touching stock', async () => {
      const product = await make.product({ stock: 3 });
      const token = await api.cart([[product.id, 1]]);

      const arrays = await api
        .checkout(token, randomUUID(), {
          customer: [],
          shipping_address: [],
          payment_method: 'pix',
        })
        .expect(422);
      expect(arrays.body.errors).toMatchObject({
        customer: ['Informe os dados do cliente.'],
        shipping_address: ['Informe o endereço de entrega.'],
      });

      const empty = await api
        .checkout(token, randomUUID(), {
          customer: {},
          shipping_address: {},
          payment_method: 'pix',
        })
        .expect(422);
      expect(empty.body.errors['customer.document']).toEqual(['CPF inválido.']);
      // First message per field is what the form shows: never the length rule.
      expect(empty.body.errors['shipping_address.city'][0]).toBe(
        'Informe a cidade.',
      );
      expect(empty.body.errors['shipping_address.line1'][0]).toBe(
        'Informe o endereço.',
      );
      expect(empty.body.errors['customer.email'][0]).toBe(
        'Informe um e-mail válido.',
      );

      expect(await stockOf(product.id)).toMatchObject({ reserved: 0 });
      expect((await cartOf(token)).status).toBe('active');
    });

    it('defaults a null country to BR', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      const body = checkoutBody();
      const res = await api
        .checkout(token, randomUUID(), {
          ...body,
          shipping_address: { ...body.shipping_address, country: null },
        })
        .expect(201);
      expect(res.body.data.shipping_address.country).toBe('BR');
    });

    it('rejects a payment method the provider does not support', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      const res = await api
        .checkout(token, randomUUID(), checkoutBody({ payment_method: 'card' }))
        .expect(422);
      expect(res.body.errors.payment_method).toEqual([
        'Forma de pagamento indisponível.',
      ]);
      expect((await cartOf(token)).status).toBe('active');
    });
  });

  describe('database invariants', () => {
    it('refuses orders and lines whose totals do not add up', async () => {
      const product = await make.product();
      const token = await api.cart([[product.id, 1]]);
      const { body } = await api.checkout(token).expect(201);

      await expect(
        db
          .update(orders)
          .set({ totalCents: body.data.total.amount + 1 })
          .where(eq(orders.id, body.data.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(orderItems)
          .set({ totalCents: 1 })
          .where(eq(orderItems.orderId, body.data.id)),
      ).rejects.toThrow();
    });
  });
});

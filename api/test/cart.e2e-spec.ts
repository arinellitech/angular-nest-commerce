import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { Database } from '../src/database/database.module.js';
import { carts, inventory, products } from '../src/database/schema.js';
import { createTestApp } from './helpers/app.js';
import { factories } from './helpers/factories.js';

describe('cart', () => {
  let app: INestApplication;
  let db: Database;
  let make: ReturnType<typeof factories>;

  const http = () => request(app.getHttpServer());

  async function newCart(): Promise<string> {
    const res = await http().post('/api/v1/cart').expect(201);
    expect(res.headers['x-cart-token']).toBe(res.body.data.token);
    return res.body.data.token as string;
  }

  const add = (token: string, product_id: number, quantity: number) =>
    http()
      .post('/api/v1/cart/items')
      .set('X-Cart-Token', token)
      .send({ product_id, quantity });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    make = factories(db);
  });

  afterAll(() => app.close());

  describe('POST /cart', () => {
    it('creates an empty guest cart and returns the token in header and body', async () => {
      const res = await http().post('/api/v1/cart').expect(201);
      expect(res.body.data).toMatchObject({
        status: 'active',
        currency: 'BRL',
        items: [],
        coupon: null,
        subtotal: { amount: 0 },
        shipping: { amount: 0 },
        total: { amount: 0 },
      });
      expect(res.body.data.token).toHaveLength(32);
      expect(res.body.data.expires_at).toEqual(expect.any(String));
    });
  });

  describe('GET /cart', () => {
    it('returns 404 without a token, with an unknown token and for an expired cart', async () => {
      await http().get('/api/v1/cart').expect(404);
      await http()
        .get('/api/v1/cart')
        .set('X-Cart-Token', 'nao-existe')
        .expect(404);

      const token = await newCart();
      await db
        .update(carts)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(carts.token, token));
      await http().get('/api/v1/cart').set('X-Cart-Token', token).expect(404);
    });

    it('returns 404 for a cart that was already converted to an order', async () => {
      const token = await newCart();
      await db
        .update(carts)
        .set({ status: 'converted' })
        .where(eq(carts.token, token));
      await http().get('/api/v1/cart').set('X-Cart-Token', token).expect(404);
    });

    it('renews expires_at on every use', async () => {
      const token = await newCart();
      await db
        .update(carts)
        .set({ expiresAt: new Date(Date.now() + 60_000) })
        .where(eq(carts.token, token));

      const res = await http()
        .get('/api/v1/cart')
        .set('X-Cart-Token', token)
        .expect(200);
      const days =
        (new Date(res.body.data.expires_at).getTime() - Date.now()) /
        86_400_000;
      expect(days).toBeGreaterThan(29);
    });

    it('keeps carts isolated between tokens', async () => {
      const product = await make.product({ priceCents: 2000 });
      const a = await newCart();
      const b = await newCart();
      await add(a, product.id, 2).expect(201);

      const cartA = await http().get('/api/v1/cart').set('X-Cart-Token', a);
      const cartB = await http().get('/api/v1/cart').set('X-Cart-Token', b);
      expect(cartA.body.data.items).toHaveLength(1);
      expect(cartB.body.data.items).toHaveLength(0);
    });
  });

  describe('items', () => {
    it('adds an item with a price snapshot, then sums quantities of the same product', async () => {
      const product = await make.product({
        priceCents: 4000,
        stock: 10,
        images: 2,
      });
      const token = await newCart();

      const first = await add(token, product.id, 2).expect(201);
      expect(first.body.data.items).toHaveLength(1);
      expect(first.body.data.items[0]).toMatchObject({
        quantity: 2,
        unit_price: { amount: 4000 },
        total: { amount: 8000 },
        available_quantity: 10,
        product: { id: product.id, slug: product.slug },
      });
      expect(first.body.data.items[0].product.images).toHaveLength(1);
      // 8000 < free-shipping threshold: flat rate applies.
      expect(first.body.data).toMatchObject({
        subtotal: { amount: 8000 },
        shipping: { amount: 1990 },
        total: { amount: 9990 },
      });

      const second = await add(token, product.id, 3).expect(201);
      expect(second.body.data.items).toHaveLength(1);
      expect(second.body.data.items[0].quantity).toBe(5);
    });

    it('updates and removes items', async () => {
      const product = await make.product({ priceCents: 1000, stock: 10 });
      const token = await newCart();
      const added = await add(token, product.id, 1).expect(201);
      const itemId = added.body.data.items[0].id as number;

      const updated = await http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', token)
        .send({ quantity: 4 })
        .expect(200);
      expect(updated.body.data.items[0].quantity).toBe(4);
      expect(updated.body.data.subtotal.amount).toBe(4000);

      const removed = await http()
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', token)
        .expect(200);
      expect(removed.body.data.items).toEqual([]);
    });

    it('refreshes the price snapshot when the line changes', async () => {
      const product = await make.product({ priceCents: 1000, stock: 10 });
      const token = await newCart();
      await add(token, product.id, 1).expect(201);

      await db
        .update(products)
        .set({ priceCents: 1500 })
        .where(eq(products.id, product.id));

      const res = await add(token, product.id, 1).expect(201);
      expect(res.body.data.items[0].unit_price.amount).toBe(1500);
      expect(res.body.data.subtotal.amount).toBe(3000);
    });

    it('returns 422 on quantity when asking for more than the available stock', async () => {
      // 5 on hand, 2 reserved by other orders -> 3 available.
      const product = await make.product({ stock: 5, reserved: 2 });
      const token = await newCart();

      const res = await add(token, product.id, 4).expect(422);
      expect(res.body.errors.quantity).toEqual([
        'Apenas 3 unidades disponíveis.',
      ]);

      await add(token, product.id, 3).expect(201);
      // The sum with what is already in the cart counts too.
      const again = await add(token, product.id, 1).expect(422);
      expect(again.body.errors.quantity).toBeDefined();

      const cart = await http().get('/api/v1/cart').set('X-Cart-Token', token);
      expect(cart.body.data.items[0].quantity).toBe(3);
    });

    it('does not reserve stock: inventory is untouched by the cart', async () => {
      const product = await make.product({ stock: 5, reserved: 0 });
      const token = await newCart();
      await add(token, product.id, 5).expect(201);
      const [row] = await db
        .select()
        .from(inventory)
        .where(eq(inventory.productId, product.id));
      expect(row).toMatchObject({ quantity: 5, reserved: 0 });
    });

    it('returns 422 on quantity when updating above the stock', async () => {
      const product = await make.product({ stock: 2 });
      const token = await newCart();
      const added = await add(token, product.id, 1).expect(201);
      const itemId = added.body.data.items[0].id as number;

      const res = await http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', token)
        .send({ quantity: 3 })
        .expect(422);
      expect(res.body.errors.quantity).toEqual([
        'Apenas 2 unidades disponíveis.',
      ]);
    });

    it('says the product is sold out when nothing is available', async () => {
      const product = await make.product({ stock: 3, reserved: 3 });
      const token = await newCart();
      const res = await add(token, product.id, 1).expect(422);
      expect(res.body.errors.quantity).toEqual(['Produto esgotado.']);
    });

    it('rejects unpublished or unknown products on product_id', async () => {
      const draft = await make.product({ publishedAt: null });
      const token = await newCart();
      const res = await add(token, draft.id, 1).expect(422);
      expect(res.body.errors.product_id).toBeDefined();
      await add(token, 999_999, 1).expect(422);
    });

    it('validates the payload', async () => {
      const token = await newCart();
      const res = await http()
        .post('/api/v1/cart/items')
        .set('X-Cart-Token', token)
        .send({ product_id: 'x', quantity: 0 })
        .expect(422);
      expect(Object.keys(res.body.errors)).toEqual(
        expect.arrayContaining(['product_id', 'quantity']),
      );
    });

    it('returns 404 for an item from another cart or an unknown item', async () => {
      const product = await make.product();
      const owner = await newCart();
      const stranger = await newCart();
      const added = await add(owner, product.id, 1).expect(201);
      const itemId = added.body.data.items[0].id as number;

      await http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', stranger)
        .send({ quantity: 2 })
        .expect(404);
      await http()
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', stranger)
        .expect(404);
      await http()
        .delete('/api/v1/cart/items/999999')
        .set('X-Cart-Token', owner)
        .expect(404);
      await http()
        .delete('/api/v1/cart/items/abc')
        .set('X-Cart-Token', owner)
        .expect(404);
    });

    it('gives free shipping at the threshold', async () => {
      const product = await make.product({ priceCents: 30_000 });
      const token = await newCart();
      const res = await add(token, product.id, 1).expect(201);
      expect(res.body.data.shipping.amount).toBe(0);
      expect(res.body.data.total.amount).toBe(30_000);
    });
  });

  describe('coupon', () => {
    async function cartWith(priceCents: number, quantity = 1) {
      const product = await make.product({ priceCents, stock: 20 });
      const token = await newCart();
      const res = await add(token, product.id, quantity).expect(201);
      return { token, itemId: res.body.data.items[0].id as number };
    }

    const apply = (token: string, code: string) =>
      http()
        .post('/api/v1/cart/coupon')
        .set('X-Cart-Token', token)
        .send({ code });

    it('applies a percent coupon above the minimum (case-insensitive)', async () => {
      const coupon = await make.coupon({ code: 'BEMVINDO10' });
      const { token } = await cartWith(10_000);

      const res = await apply(token, 'bemvindo10').expect(200);
      expect(res.body.data.coupon).toEqual({
        code: coupon.code,
        discount: expect.objectContaining({ amount: 1000 }),
      });
      expect(res.body.data).toMatchObject({
        subtotal: { amount: 10_000 },
        discount: { amount: 1000 },
        shipping: { amount: 1990 },
        total: { amount: 10_990 },
      });
    });

    it('rejects an unknown code on errors.code', async () => {
      const { token } = await cartWith(10_000);
      const res = await apply(token, 'NAOEXISTE').expect(422);
      expect(res.body.errors.code).toEqual(['Cupom inválido.']);
    });

    it('rejects expired, inactive and exhausted coupons', async () => {
      const { token } = await cartWith(10_000);
      const expired = await make.coupon({
        endsAt: new Date(Date.now() - 1000),
      });
      const inactive = await make.coupon({ isActive: false });
      const exhausted = await make.coupon({ maxUses: 1, uses: 1 });

      expect(
        (await apply(token, expired.code).expect(422)).body.errors.code,
      ).toEqual(['Este cupom expirou.']);
      expect(
        (await apply(token, inactive.code).expect(422)).body.errors.code,
      ).toEqual(['Cupom inválido.']);
      expect(
        (await apply(token, exhausted.code).expect(422)).body.errors.code,
      ).toEqual(['Este cupom atingiu o limite de usos.']);
    });

    it('rejects a cart below the coupon minimum', async () => {
      const coupon = await make.coupon({ minSubtotalCents: 5000 });
      const { token } = await cartWith(4000);
      const res = await apply(token, coupon.code).expect(422);
      expect(res.body.errors.code[0]).toMatch(/^Pedido mínimo de R\$\s50,00/);
    });

    it('drops the coupon when the cart falls below its minimum', async () => {
      const coupon = await make.coupon({ minSubtotalCents: 5000 });
      const { token, itemId } = await cartWith(3000, 2);
      await apply(token, coupon.code).expect(200);

      const res = await http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('X-Cart-Token', token)
        .send({ quantity: 1 })
        .expect(200);
      expect(res.body.data.coupon).toBeNull();
      expect(res.body.data.discount.amount).toBe(0);
    });

    it('removes the coupon, and removing it twice is harmless', async () => {
      const coupon = await make.coupon();
      const { token } = await cartWith(10_000);
      await apply(token, coupon.code).expect(200);

      const res = await http()
        .delete('/api/v1/cart/coupon')
        .set('X-Cart-Token', token)
        .expect(200);
      expect(res.body.data.coupon).toBeNull();
      expect(res.body.data.total.amount).toBe(10_000 + 1990);
      await http()
        .delete('/api/v1/cart/coupon')
        .set('X-Cart-Token', token)
        .expect(200);
    });

    it('validates the payload', async () => {
      const { token } = await cartWith(10_000);
      await http()
        .post('/api/v1/cart/coupon')
        .set('X-Cart-Token', token)
        .send({})
        .expect(422);
    });
  });
});

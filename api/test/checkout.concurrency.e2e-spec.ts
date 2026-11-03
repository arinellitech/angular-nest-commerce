import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { Database } from '../src/database/database.module.js';
import { coupons, inventory, orders } from '../src/database/schema.js';
import { PaymentGateway } from '../src/payments/payment-gateway.js';
import { factories } from './helpers/factories.js';
import { shop } from './helpers/shop.js';

/**
 * Row locks only mean something with real concurrent connections, and PGlite
 * has a single one. These tests run against PostgreSQL when DATABASE_URL is
 * set (e.g. `DATABASE_URL=postgres://commerce:commerce@127.0.0.1:5432/commerce
 * npm run test:e2e`), inside a throwaway database created and dropped here, so
 * the database behind DATABASE_URL is never touched. The sequential version of
 * "last unit" runs on PGlite in checkout.e2e-spec.ts.
 */
const adminUrl = process.env.DATABASE_URL;

describe.skipIf(!adminUrl)('checkout concurrency (PostgreSQL)', () => {
  const dbName = `commerce_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let app: INestApplication | undefined;
  let db: Database;
  let make: ReturnType<typeof factories>;
  let api: ReturnType<typeof shop>;

  async function admin(statement: string): Promise<void> {
    const client = new pg.Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  }

  const statuses = (responses: { status: number }[]) =>
    responses.map((r) => r.status).sort((a, b) => a - b);

  beforeAll(async () => {
    await admin(`CREATE DATABASE "${dbName}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;

    const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    await pool.end();

    // AppModule reads the environment when it is imported: switch the driver first.
    vi.stubEnv('DATABASE_DRIVER', 'pg');
    vi.stubEnv('DATABASE_URL', url.toString());
    vi.stubEnv('DATABASE_POOL_MAX', '20');
    const { createTestApp } = await import('./helpers/app.js');
    ({ app, db } = await createTestApp());
    make = factories(db);
    api = shop(app);
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    await admin(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  });

  it('sells the last unit exactly once when two checkouts race', async () => {
    const product = await make.product({ stock: 1 });
    const carts = [
      await api.cart([[product.id, 1]]),
      await api.cart([[product.id, 1]]),
    ];

    const responses = await Promise.all(carts.map((t) => api.checkout(t)));

    expect(statuses(responses)).toEqual([201, 422]);
    const loser = responses.find((r) => r.status === 422)!;
    expect(loser.body.unavailable[0]).toMatchObject({
      product_id: product.id,
      available: 0,
    });
    const stock = await db.query.inventory.findFirst({
      where: eq(inventory.productId, product.id),
    });
    expect(stock).toMatchObject({ quantity: 1, reserved: 1 });
  });

  it('never oversells under a burst: 8 buyers, 3 units', async () => {
    const product = await make.product({ stock: 3 });
    const carts = await Promise.all(
      Array.from({ length: 8 }, () => api.cart([[product.id, 1]])),
    );

    const responses = await Promise.all(carts.map((t) => api.checkout(t)));

    expect(statuses(responses)).toEqual([
      201, 201, 201, 422, 422, 422, 422, 422,
    ]);
    const stock = await db.query.inventory.findFirst({
      where: eq(inventory.productId, product.id),
    });
    expect(stock).toMatchObject({ quantity: 3, reserved: 3 });
  });

  it('does not deadlock when carts lock the same products in different orders', async () => {
    const a = await make.product({ stock: 10 });
    const b = await make.product({ stock: 10 });
    const carts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api.cart(
          i % 2 === 0
            ? [
                [a.id, 1],
                [b.id, 1],
              ]
            : [
                [b.id, 1],
                [a.id, 1],
              ],
        ),
      ),
    );

    const responses = await Promise.all(carts.map((t) => api.checkout(t)));

    expect(statuses(responses)).toEqual(Array(6).fill(201));
    const rows = await db.query.inventory.findMany({
      where: inArray(inventory.productId, [a.id, b.id]),
    });
    expect(rows.map((r) => r.reserved)).toEqual([6, 6]);
  });

  it('turns concurrent retries with one key into one order (201 once, 200 for the rest)', async () => {
    const product = await make.product({ stock: 5 });
    const token = await api.cart([[product.id, 2]]);
    const key = randomUUID();
    const charge = vi.spyOn(app!.get(PaymentGateway), 'charge');

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => api.checkout(token, key)),
    );

    // Replays may reach the provider more than once, always for the same
    // payment: the provider-side idempotency key makes it one charge.
    const keys = new Set(charge.mock.calls.map((call) => call[2]));
    charge.mockRestore();
    expect(keys.size).toBe(1);

    expect(statuses(responses)).toEqual([200, 200, 200, 201]);
    expect(new Set(responses.map((r) => r.body.data.id)).size).toBe(1);
    expect(
      await db.query.orders.findMany({ where: eq(orders.idempotencyKey, key) }),
    ).toHaveLength(1);
    const stock = await db.query.inventory.findFirst({
      where: eq(inventory.productId, product.id),
    });
    expect(stock!.reserved).toBe(2);
  });

  it('lets only one cart claim a key used by two carts at once', async () => {
    const first = await make.product({ stock: 5 });
    const second = await make.product({ stock: 5 });
    const carts = [
      await api.cart([[first.id, 1]]),
      await api.cart([[second.id, 1]]),
    ];
    const key = randomUUID();

    const responses = await Promise.all(carts.map((t) => api.checkout(t, key)));

    expect(statuses(responses)).toEqual([201, 422]);
    const loser = responses.find((r) => r.status === 422)!;
    expect(loser.body.errors.idempotency_key).toHaveLength(1);
    const rows = await db.query.inventory.findMany({
      where: inArray(inventory.productId, [first.id, second.id]),
    });
    // The loser's reservation was rolled back.
    expect(rows.map((r) => r.reserved).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('respects max_uses when two carts redeem the last coupon use together', async () => {
    const coupon = await make.coupon({ maxUses: 1, minSubtotalCents: 0 });
    const product = await make.product({ priceCents: 10_000, stock: 10 });
    const carts = [
      await api.cart([[product.id, 1]], coupon.code),
      await api.cart([[product.id, 1]], coupon.code),
    ];

    const responses = await Promise.all(carts.map((t) => api.checkout(t)));

    expect(statuses(responses)).toEqual([201, 201]);
    const discounts = responses
      .map((r) => r.body.data.discount.amount as number)
      .sort((x, y) => x - y);
    expect(discounts).toEqual([0, 1000]);
    const after = await db.query.coupons.findFirst({
      where: eq(coupons.id, coupon.id),
    });
    expect(after!.uses).toBe(1);
  });
});

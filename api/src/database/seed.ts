/**
 * Development seed: categories tree, ~40 products with images and stock,
 * two coupons and a demo customer. Idempotent (truncates catalog tables first).
 * Usage: npm run db:seed
 */
import { fakerPT_BR as faker } from '@faker-js/faker';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { slugify } from '../common/slug.js';
import * as schema from './schema.js';

const url =
  process.env.DATABASE_URL ??
  'postgres://commerce:commerce@127.0.0.1:5432/commerce';
const ssl =
  process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;
const pool = new Pool({ connectionString: url, ssl, max: 1 });
const db = drizzle(pool, { schema });

faker.seed(42);

const tree: Record<string, string[]> = {
  Eletrônicos: ['Fones de ouvido', 'Teclados', 'Monitores'],
  Casa: ['Cozinha', 'Decoração'],
  Esporte: ['Corrida', 'Ciclismo'],
};

try {
  await db.execute(
    sql`TRUNCATE TABLE stock_movements, inventory, product_images, products, categories, coupons RESTART IDENTITY CASCADE`,
  );

  let position = 0;
  let skuCounter = 10000;

  for (const [parentName, children] of Object.entries(tree)) {
    const [parent] = await db
      .insert(schema.categories)
      .values({
        name: parentName,
        slug: slugify(parentName),
        position: position++,
      })
      .returning();

    for (const childName of children) {
      const [child] = await db
        .insert(schema.categories)
        .values({
          parentId: parent!.id,
          name: childName,
          slug: slugify(childName),
          position: position++,
        })
        .returning();

      for (let i = 0; i < 6; i++) {
        const name = `${faker.commerce.productAdjective()} ${childName.split(' ')[0]} ${faker.string.alpha({ length: 3, casing: 'upper' })}`;
        const price = faker.number.int({ min: 1990, max: 89990 });
        const slug = `${slugify(name)}-${faker.number.int({ min: 1000, max: 9999 })}`;

        const [product] = await db
          .insert(schema.products)
          .values({
            categoryId: child!.id,
            name,
            slug,
            sku: `${faker.string.alpha({ length: 3, casing: 'upper' })}-${skuCounter++}`,
            description: faker.commerce.productDescription(),
            priceCents: price,
            compareAtPriceCents: faker.datatype.boolean(0.3)
              ? Math.round(price * 1.25)
              : null,
            specs: { cor: faker.color.human() },
            publishedAt: faker.date.recent({ days: 60 }),
          })
          .returning();

        await db
          .insert(schema.inventory)
          .values({ productId: product!.id, quantity: 25, reserved: 0 });
        await db.insert(schema.productImages).values(
          [0, 1].map((n) => ({
            productId: product!.id,
            path: `https://picsum.photos/seed/${slug}-${n}/800/800`,
            alt: name,
            position: n,
          })),
        );
      }
    }
  }

  // Edge cases for the storefront.
  const [soldOut] = await db
    .insert(schema.products)
    .values({
      name: 'Produto esgotado',
      slug: 'produto-esgotado',
      sku: 'EDGE-0001',
      priceCents: 9990,
      publishedAt: new Date(),
    })
    .returning();
  await db
    .insert(schema.inventory)
    .values({ productId: soldOut!.id, quantity: 0, reserved: 0 });

  const [unpublished] = await db
    .insert(schema.products)
    .values({
      name: 'Produto não publicado',
      slug: 'produto-nao-publicado',
      sku: 'EDGE-0002',
      priceCents: 9990,
    })
    .returning();
  await db
    .insert(schema.inventory)
    .values({ productId: unpublished!.id, quantity: 10, reserved: 0 });

  await db.insert(schema.coupons).values([
    { code: 'BEMVINDO10', type: 'percent', value: 10, minSubtotalCents: 5000 },
    {
      code: 'FRETE20',
      type: 'fixed',
      value: 2000,
      minSubtotalCents: 10000,
      maxUses: 100,
    },
  ]);

  await db
    .insert(schema.users)
    .values({
      name: 'Cliente Demo',
      email: 'cliente@example.com',
      // "password" — replaced by argon2 in PROMPT 05; never used for login until then.
      passwordHash: 'not-a-real-hash',
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log('Seed complete.');
} finally {
  await pool.end();
}

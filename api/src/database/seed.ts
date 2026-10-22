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
import { loadEnv, reindexCatalog } from '../search/search.cli.js';
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
  const categoryIds = new Map<string, number>();

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
      categoryIds.set(child!.slug, child!.id);

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

  // Hand-written products with real names, for search demos ("teclado mecanico").
  const showcase: (Omit<typeof schema.products.$inferInsert, 'categoryId'> & {
    category: string;
  })[] = [
    {
      category: 'teclados',
      name: 'Teclado Mecânico RGB',
      slug: 'teclado-mecanico-rgb',
      sku: 'SHOW-0001',
      priceCents: 34990,
      description: 'Teclado mecânico ABNT2 com switches táteis e iluminação RGB.',
      specs: { switch: 'Gateron Brown', layout: 'ABNT2' },
    },
    {
      category: 'teclados',
      name: 'Teclado Mecânico Compacto 60%',
      slug: 'teclado-mecanico-compacto-60',
      sku: 'SHOW-0002',
      priceCents: 27990,
      description: 'Formato 60% sem fio, ideal para mesas pequenas.',
      specs: { switch: 'Outemu Red', layout: 'ANSI' },
    },
    {
      category: 'fones-de-ouvido',
      name: 'Fone de Ouvido Bluetooth com Cancelamento de Ruído',
      slug: 'fone-bluetooth-cancelamento-de-ruido',
      sku: 'SHOW-0003',
      priceCents: 59990,
      description: 'Cancelamento ativo de ruído e 30 horas de bateria.',
      specs: { bateria: '30h', conexao: 'Bluetooth 5.3' },
    },
  ];
  for (const { category, ...values } of showcase) {
    const [product] = await db
      .insert(schema.products)
      .values({
        ...values,
        categoryId: categoryIds.get(category)!,
        publishedAt: new Date(),
      })
      .returning();
    await db
      .insert(schema.inventory)
      .values({ productId: product!.id, quantity: 15, reserved: 0 });
    await db.insert(schema.productImages).values({
      productId: product!.id,
      path: `https://picsum.photos/seed/${values.slug}/800/800`,
      alt: values.name,
      position: 0,
    });
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

  // The catalog works without Meilisearch (SQL fallback), so a missing
  // server only warns instead of failing `npm run setup`.
  try {
    const indexed = await reindexCatalog(db, loadEnv());
    console.log(`Search index rebuilt: ${indexed} products.`);
  } catch (error) {
    console.warn(
      `Search index not rebuilt (${error instanceof Error ? error.message : String(error)}). Start Meilisearch and run: npm run search:reindex`,
    );
  }
} finally {
  await pool.end();
}

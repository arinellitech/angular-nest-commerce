import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { CatalogService } from '../src/catalog/catalog.service.js';
import type { Database } from '../src/database/database.module.js';
import { inventory, products, type Product } from '../src/database/schema.js';
import { createTestApp } from './helpers/app.js';
import { factories } from './helpers/factories.js';
import type { InMemorySearchClient } from './helpers/in-memory-search.client.js';

type Item = { slug: string };
const slugs = (body: { data: Item[] }) => body.data.map((p) => p.slug);

describe('search (GET /api/v1/products?search=)', () => {
  let app: INestApplication;
  let db: Database;
  let search: InMemorySearchClient;
  let rgb: Product;
  let compacto: Product;

  beforeAll(async () => {
    let reindex: () => Promise<number>;
    ({ app, db, search, reindex } = await createTestApp());
    const make = factories(db);

    const eletronicos = await make.category({
      name: 'Eletrônicos',
      slug: 'eletronicos',
    });
    const teclados = await make.category({
      parentId: eletronicos.id,
      name: 'Teclados',
      slug: 'teclados',
    });
    const mouses = await make.category({
      parentId: eletronicos.id,
      name: 'Mouses',
      slug: 'mouses',
    });

    rgb = await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico RGB',
      slug: 'teclado-rgb',
      priceCents: 34990,
      specs: { switch: 'Gateron Brown' },
    });
    compacto = await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico Compacto',
      slug: 'teclado-compacto',
      priceCents: 27990,
    });
    await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico Esgotado',
      slug: 'teclado-esgotado',
      priceCents: 19990,
      stock: 0,
    });
    await make.product({
      categoryId: teclados.id,
      name: 'Teclado de Membrana',
      slug: 'teclado-membrana',
      priceCents: 9990,
    });
    await make.product({
      categoryId: mouses.id,
      name: 'Mouse com Switch Mecânico',
      slug: 'mouse-mecanico',
      priceCents: 25990,
    });
    // Never visible: not published, inactive, scheduled for the future.
    await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico Protótipo',
      slug: 'teclado-prototipo',
      publishedAt: null,
    });
    await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico Antigo',
      slug: 'teclado-antigo',
      isActive: false,
    });
    await make.product({
      categoryId: teclados.id,
      name: 'Teclado Mecânico Lançamento',
      slug: 'teclado-lancamento',
      publishedAt: new Date(Date.now() + 86_400_000),
    });

    await reindex();
  });

  afterAll(() => app.close());

  const get = (query: string) =>
    request(app.getHttpServer()).get(`/api/v1/products?${query}`).expect(200);

  it('tolerates typos and missing accents', async () => {
    const expected = ['teclado-compacto', 'teclado-esgotado', 'teclado-rgb'];

    const typo = await get('search=tecaldo mecanico');
    expect(slugs(typo.body).sort()).toEqual(expected);

    const noAccent = await get('search=teclado mecanico');
    expect(slugs(noAccent.body).sort()).toEqual(expected);
    expect(noAccent.body.data[0]).toMatchObject({
      price: { amount: expect.any(Number), currency: 'BRL' },
      in_stock: expect.any(Boolean),
    });
  });

  it('filters by category and price and returns disjunctive facets', async () => {
    const res = await get(
      'search=mecanico&category=teclados&min_price=20000&max_price=40000&sort=price_asc',
    );

    expect(slugs(res.body)).toEqual(['teclado-compacto', 'teclado-rgb']);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.facets).toEqual({
      // Ignores the category filter (keeps the price one): other categories stay selectable.
      categories: [
        { slug: 'teclados', name: 'Teclados', count: 2 },
        { slug: 'mouses', name: 'Mouses', count: 1 },
      ],
      // Ignores the price filter (keeps the category one): the full range stays visible.
      price: {
        min: expect.objectContaining({ amount: 19990, currency: 'BRL' }),
        max: expect.objectContaining({ amount: 34990, currency: 'BRL' }),
      },
    });
  });

  it('includes subcategories when filtering by a parent category', async () => {
    const res = await get(
      'search=mecanico&category=eletronicos&sort=price_asc',
    );
    expect(slugs(res.body)).toEqual([
      'teclado-esgotado',
      'mouse-mecanico',
      'teclado-compacto',
      'teclado-rgb',
    ]);
  });

  it('sorts and filters by stock', async () => {
    const res = await get('search=mecanico&sort=price_desc&in_stock=1');
    expect(slugs(res.body)).toEqual([
      'teclado-rgb',
      'teclado-compacto',
      'mouse-mecanico',
    ]);
  });

  it('ranks by relevance by default and keeps the engine order', async () => {
    const make = factories(db);
    // Higher id but an exact match: relevance must put it first, unlike id order.
    const office = await make.product({
      name: 'Cadeira Escritório',
      slug: 'cadeira-escritorio',
    });
    const gamer = await make.product({
      name: 'Cadeiras Gamer',
      slug: 'cadeiras-gamer',
    });
    await app.get(CatalogService).syncSearchIndex([office.id, gamer.id]);

    const byDefault = await get('search=cadeiras');
    expect(slugs(byDefault.body)).toEqual([
      'cadeiras-gamer',
      'cadeira-escritorio',
    ]);
    expect(byDefault.body.links.first).not.toContain('sort=');

    const explicit = await get('search=cadeiras&sort=relevance');
    expect(slugs(explicit.body)).toEqual(slugs(byDefault.body));

    const byName = await get('search=cadeiras&sort=name');
    expect(slugs(byName.body)).toEqual([
      'cadeira-escritorio',
      'cadeiras-gamer',
    ]);
  });

  it('rejects an overly long search with a 422', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/products?search=${'a'.repeat(121)}`)
      .expect(422);
    expect(res.body.errors).toHaveProperty('search');
  });

  it('re-checks price and stock in Postgres for hits the index has stale', async () => {
    // Repriced below the filter in the database only (index still says 27990).
    await db
      .update(products)
      .set({ priceCents: 15000 })
      .where(eq(products.id, compacto.id));
    const repriced = await get(
      'search=mecanico&category=teclados&min_price=20000',
    );
    expect(slugs(repriced.body)).toEqual(['teclado-rgb']);
    expect(repriced.body.meta.total).toBe(1);
    await db
      .update(products)
      .set({ priceCents: 27990 })
      .where(eq(products.id, compacto.id));

    // Fully reserved in the database only (index still says in stock).
    await db
      .update(inventory)
      .set({ reserved: 25 })
      .where(eq(inventory.productId, rgb.id));
    const soldOut = await get('search=mecanico&in_stock=1&sort=price_desc');
    expect(slugs(soldOut.body)).toEqual(['teclado-compacto', 'mouse-mecanico']);
    await db
      .update(inventory)
      .set({ reserved: 0 })
      .where(eq(inventory.productId, rgb.id));
  });

  it('paginates search results with links and meta', async () => {
    const res = await get('search=mecanico&sort=name&per_page=3&page=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({
      current_page: 2,
      last_page: 2,
      per_page: 3,
      total: 4,
      from: 4,
      to: 4,
    });
    expect(res.body.links.prev).toContain('search=mecanico');
    expect(res.body.links.prev).toContain('page=1');
    expect(res.body.links.next).toBeNull();
  });

  it('never indexes or returns unpublished, inactive or scheduled products', async () => {
    const hidden = [
      'teclado-prototipo',
      'teclado-antigo',
      'teclado-lancamento',
    ];

    const res = await get('search=teclado&per_page=60');
    for (const slug of hidden) expect(slugs(res.body)).not.toContain(slug);

    const indexed = search.documents().map((d) => d.name);
    expect(indexed).not.toContain('Teclado Mecânico Protótipo');
    expect(indexed).not.toContain('Teclado Mecânico Antigo');
    expect(indexed).not.toContain('Teclado Mecânico Lançamento');
  });

  it('returns no results and empty facets for an unknown category', async () => {
    const res = await get('search=mecanico&category=nao-existe');
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.facets).toEqual({ categories: [], price: null });
  });

  it('only returns facets when searching', async () => {
    const res = await get('category=teclados');
    expect(res.body.meta.facets).toBeUndefined();
  });

  it('falls back to SQL (no facets) when the search engine is down', async () => {
    search.down = true;
    try {
      const res = await get('search=Teclado Mecânico C');
      expect(slugs(res.body)).toEqual(['teclado-compacto']);
      expect(res.body.meta.facets).toBeUndefined();
    } finally {
      search.down = false;
    }
  });

  it('drops stale hits and resyncs a product through the catalog hook', async () => {
    await db
      .update(products)
      .set({ publishedAt: null })
      .where(eq(products.id, rgb.id));

    // Index not synced yet: Postgres still hides the product.
    const stale = await get('search=mecanico&per_page=60');
    expect(slugs(stale.body)).not.toContain('teclado-rgb');
    expect(search.documents().map((d) => d.id)).toContain(rgb.id);

    const catalog = app.get(CatalogService);
    await catalog.syncSearchIndex([rgb.id]);
    expect(search.documents().map((d) => d.id)).not.toContain(rgb.id);

    await db
      .update(products)
      .set({ publishedAt: new Date(Date.now() - 60_000), priceCents: 31990 })
      .where(eq(products.id, rgb.id));
    await catalog.syncSearchIndex([rgb.id]);
    expect(search.documents().find((d) => d.id === rgb.id)).toMatchObject({
      price_cents: 31990,
      specs: ['switch: Gateron Brown'],
    });
  });
});

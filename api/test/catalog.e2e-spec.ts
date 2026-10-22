import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Database } from '../src/database/database.module.js';
import { createTestApp } from './helpers/app.js';
import { factories } from './helpers/factories.js';

describe('catalog', () => {
  let app: INestApplication;
  let db: Database;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    make = factories(db);
  });

  afterAll(() => app.close());

  describe('GET /api/v1/categories', () => {
    it('lists only active root categories with their children and product counts', async () => {
      const root = await make.category({
        name: 'Eletrônicos',
        slug: 'eletronicos',
        position: 0,
      });
      const child = await make.category({
        parentId: root.id,
        name: 'Fones',
        slug: 'fones',
      });
      await make.category({ name: 'Oculta', slug: 'oculta', isActive: false });
      await make.product({ categoryId: child.id });
      await make.product({ categoryId: child.id, publishedAt: null });

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      const slugs = res.body.data.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain('eletronicos');
      expect(slugs).not.toContain('oculta');
      const eletronicos = res.body.data.find(
        (c: { slug: string }) => c.slug === 'eletronicos',
      );
      expect(eletronicos.children[0].slug).toBe('fones');
      expect(eletronicos.children[0].products_count).toBe(1);
    });

    it('returns 404 for an unknown category', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/nao-existe')
        .expect(404);
    });
  });

  describe('GET /api/v1/products', () => {
    it('lists published products with price, images and stock', async () => {
      await make.product({
        name: 'Fone X',
        slug: 'fone-x',
        priceCents: 19990,
        images: 2,
      });
      await make.product({ slug: 'nao-publicado', publishedAt: null });
      await make.product({ slug: 'inativo', isActive: false });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products?search=Fone X')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      const item = res.body.data[0];
      expect(item.price).toEqual({
        amount: 19990,
        currency: 'BRL',
        formatted: expect.stringContaining('199,90'),
      });
      expect(item.images).toHaveLength(2);
      expect(item.in_stock).toBe(true);
      expect(res.body.meta).toMatchObject({ current_page: 1, per_page: 24 });
      expect(res.body.links).toHaveProperty('first');

      const all = await request(app.getHttpServer())
        .get('/api/v1/products?per_page=60')
        .expect(200);
      const slugs = all.body.data.map((p: { slug: string }) => p.slug);
      expect(slugs).not.toContain('nao-publicado');
      expect(slugs).not.toContain('inativo');
    });

    it('filters by category, price range and stock', async () => {
      const category = await make.category({ slug: 'teclados' });
      await make.product({
        categoryId: category.id,
        slug: 'barato',
        priceCents: 5000,
      });
      await make.product({
        categoryId: category.id,
        slug: 'caro',
        priceCents: 50000,
      });
      await make.product({
        categoryId: category.id,
        slug: 'esgotado',
        priceCents: 7000,
        stock: 0,
      });
      await make.product({
        categoryId: category.id,
        slug: 'reservado',
        priceCents: 7500,
        stock: 3,
        reserved: 3,
      });
      await make.product({ slug: 'outra-categoria', priceCents: 6000 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products?category=teclados&max_price=10000&in_stock=1')
        .expect(200);

      expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual([
        'barato',
      ]);
      expect(res.body.meta.total).toBe(1);
    });

    it('searches by name and sorts by price', async () => {
      await make.product({
        name: 'Teclado Mecânico Azul',
        slug: 'teclado-azul',
        priceCents: 30000,
      });
      await make.product({
        name: 'Teclado Compacto',
        slug: 'teclado-compacto',
        priceCents: 12000,
      });
      await make.product({ name: 'Mouse', slug: 'mouse', priceCents: 9000 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products?search=teclado&sort=price_asc')
        .expect(200);

      expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual([
        'teclado-compacto',
        'teclado-azul',
      ]);
    });

    it('paginates with links and meta', async () => {
      const category = await make.category({ slug: 'paginada' });
      for (let i = 0; i < 5; i++)
        await make.product({ categoryId: category.id, slug: `pag-${i}` });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products?category=paginada&per_page=2&page=2')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        current_page: 2,
        last_page: 3,
        per_page: 2,
        total: 5,
        from: 3,
        to: 4,
      });
      expect(res.body.links.next).toContain('page=3');
      expect(res.body.links.prev).toContain('page=1');
    });

    it('validates query parameters with a 422 and field errors', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?sort=random&per_page=500')
        .expect(422);

      expect(res.body.message).toBe('Validation failed.');
      expect(res.body.errors).toHaveProperty('sort');
      expect(res.body.errors).toHaveProperty('per_page');
    });
  });

  describe('GET /api/v1/products/:slug', () => {
    it('shows a published product and hides unpublished ones', async () => {
      await make.product({ slug: 'visivel', images: 1 });
      await make.product({ slug: 'invisivel', publishedAt: null });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products/visivel')
        .expect(200);
      expect(res.body.data).toMatchObject({
        slug: 'visivel',
        price: { amount: 9990 },
        in_stock: true,
        available_quantity: 25,
      });
      expect(res.body.data.images).toHaveLength(1);

      await request(app.getHttpServer())
        .get('/api/v1/products/invisivel')
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/products/nao-existe')
        .expect(404);
    });
  });
});

import type { Category, Inventory, Product } from '../database/schema.js';
import { isPublished, toProductDocument } from './product-document.js';

const now = new Date('2026-10-22T12:00:00Z');

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 7,
  categoryId: 3,
  name: 'Teclado Mecânico RGB',
  slug: 'teclado-mecanico-rgb',
  sku: 'SHOW-0001',
  description: 'ABNT2',
  priceCents: 34990,
  compareAtPriceCents: null,
  currency: 'BRL',
  specs: { switch: 'Gateron Brown', layout: 'ABNT2' },
  isActive: true,
  publishedAt: new Date('2026-10-01T00:00:00Z'),
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const category = { slug: 'teclados', name: 'Teclados' } as Category;
const stock = (quantity: number, reserved = 0) =>
  ({ productId: 7, quantity, reserved }) as Inventory;

describe('toProductDocument', () => {
  it('maps a product to its search document', () => {
    expect(
      toProductDocument(
        { ...product(), category, inventory: stock(10, 2) },
        now,
      ),
    ).toEqual({
      id: 7,
      name: 'Teclado Mecânico RGB',
      sku: 'SHOW-0001',
      description: 'ABNT2',
      category: { slug: 'teclados', name: 'Teclados' },
      price_cents: 34990,
      in_stock: true,
      published: true,
      published_at: Date.parse('2026-10-01T00:00:00Z') / 1000,
      specs: ['switch: Gateron Brown', 'layout: ABNT2'],
    });
  });

  it('marks fully reserved or missing inventory as out of stock', () => {
    const base = { ...product(), category: null };
    expect(
      toProductDocument({ ...base, inventory: stock(3, 3) }, now).in_stock,
    ).toBe(false);
    expect(toProductDocument({ ...base, inventory: null }, now)).toMatchObject(
      { in_stock: false, category: null },
    );
  });
});

describe('isPublished', () => {
  it.each([
    ['published', {}, true],
    ['never published', { publishedAt: null }, false],
    ['scheduled', { publishedAt: new Date('2026-11-01T00:00:00Z') }, false],
    ['inactive', { isActive: false }, false],
    ['deleted', { deletedAt: now }, false],
  ] as const)('%s → %s', (_, overrides, expected) => {
    expect(isPublished(product(overrides), now)).toBe(expected);
  });
});

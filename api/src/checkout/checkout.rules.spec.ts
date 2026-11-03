import type { Inventory, Product } from '../database/schema.js';
import {
  describeLineProblem,
  LineProblemReason,
  reviewCartLines,
} from './checkout.rules.js';

const now = new Date('2026-10-31T12:00:00Z');

function product(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    categoryId: null,
    name: `Produto ${id}`,
    slug: `produto-${id}`,
    sku: `SKU-${id}`,
    description: null,
    priceCents: 5000,
    compareAtPriceCents: null,
    currency: 'BRL',
    specs: null,
    isActive: true,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function stock(productId: number, quantity: number, reserved = 0): Inventory {
  return { productId, quantity, reserved, createdAt: now, updatedAt: now };
}

describe('reviewCartLines', () => {
  it('passes lines that are published and in stock, at the live price', () => {
    const result = reviewCartLines(
      [
        { productId: 1, quantity: 2, unitPriceCents: 5000 },
        { productId: 2, quantity: 1, unitPriceCents: 4000 },
      ],
      new Map([
        [1, product(1)],
        [2, product(2, { priceCents: 4500 })],
      ]),
      new Map([
        [1, stock(1, 2)],
        [2, stock(2, 10, 9)],
      ]),
      now,
    );
    expect(result.problems).toEqual([]);
    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: 1,
        quantity: 2,
        unitPriceCents: 5000,
        priceChanged: false,
      }),
      expect.objectContaining({
        productId: 2,
        unitPriceCents: 4500,
        priceChanged: true,
      }),
    ]);
  });

  it('counts reserved units as unavailable', () => {
    const { problems } = reviewCartLines(
      [{ productId: 1, quantity: 2, unitPriceCents: 5000 }],
      new Map([[1, product(1)]]),
      new Map([[1, stock(1, 5, 4)]]),
      now,
    );
    expect(problems).toEqual([
      {
        productId: 1,
        name: 'Produto 1',
        requested: 2,
        available: 1,
        reason: LineProblemReason.InsufficientStock,
      },
    ]);
  });

  it('flags unpublished, inactive, deleted, future and missing products', () => {
    const { lines, problems } = reviewCartLines(
      [1, 2, 3, 4, 5].map((productId) => ({
        productId,
        quantity: 1,
        unitPriceCents: 5000,
      })),
      new Map([
        [1, product(1, { publishedAt: null })],
        [2, product(2, { isActive: false })],
        [3, product(3, { deletedAt: now })],
        [4, product(4, { publishedAt: new Date('2027-01-01T00:00:00Z') })],
      ]),
      new Map([1, 2, 3, 4, 5].map((id) => [id, stock(id, 10)])),
      now,
    );
    expect(lines).toEqual([]);
    expect(problems.map((p) => p.reason)).toEqual(
      Array(5).fill(LineProblemReason.Unavailable),
    );
    expect(problems[4]!.name).toBe('Produto #5');
  });

  it('treats a product without an inventory row as out of stock', () => {
    const { problems } = reviewCartLines(
      [{ productId: 1, quantity: 1, unitPriceCents: 5000 }],
      new Map([[1, product(1)]]),
      new Map(),
      now,
    );
    expect(problems[0]).toMatchObject({ available: 0 });
  });
});

describe('describeLineProblem', () => {
  const base = { productId: 1, name: 'Teclado', requested: 3 };

  it('words each case in pt-BR', () => {
    expect(
      describeLineProblem({ ...base, available: 0, reason: 'unavailable' }),
    ).toBe('Teclado não está mais disponível.');
    expect(
      describeLineProblem({
        ...base,
        available: 0,
        reason: 'insufficient_stock',
      }),
    ).toBe('Teclado está esgotado.');
    expect(
      describeLineProblem({
        ...base,
        available: 1,
        reason: 'insufficient_stock',
      }),
    ).toBe('Teclado: apenas 1 unidade disponível.');
    expect(
      describeLineProblem({
        ...base,
        available: 2,
        reason: 'insufficient_stock',
      }),
    ).toBe('Teclado: apenas 2 unidades disponíveis.');
  });
});

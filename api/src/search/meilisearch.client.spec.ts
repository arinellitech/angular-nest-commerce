import type { Meilisearch } from 'meilisearch';
import {
  MeilisearchClient,
  toFilterExpression,
  toSortExpression,
} from './meilisearch.client.js';

describe('toFilterExpression', () => {
  const filters = {
    categorySlugs: ['teclados', 'mouses'],
    minPriceCents: 1000,
    maxPriceCents: 5000,
    inStock: true,
  };

  it('ANDs every filter and always restricts to published products', () => {
    expect(toFilterExpression(filters)).toEqual([
      'published = true',
      'category.slug IN ["teclados", "mouses"]',
      'price_cents >= 1000',
      'price_cents <= 5000',
      'in_stock = true',
    ]);
    expect(toFilterExpression({})).toEqual(['published = true']);
  });

  it('omits one dimension for disjunctive facets', () => {
    expect(toFilterExpression(filters, 'category')).not.toContainEqual(
      expect.stringContaining('category.slug'),
    );
    expect(toFilterExpression(filters, 'price')).toEqual([
      'published = true',
      'category.slug IN ["teclados", "mouses"]',
      'in_stock = true',
    ]);
  });

  it('escapes quotes in slugs', () => {
    expect(toFilterExpression({ categorySlugs: ['a"b'] })[1]).toBe(
      'category.slug IN ["a\\"b"]',
    );
  });
});

describe('toSortExpression', () => {
  it('maps API sorts to index sorts; relevance leaves ranking alone', () => {
    expect(toSortExpression('relevance')).toBeUndefined();
    expect(toSortExpression('newest')).toEqual(['published_at:desc']);
    expect(toSortExpression('price_asc')).toEqual(['price_cents:asc']);
    expect(toSortExpression('price_desc')).toEqual(['price_cents:desc']);
    expect(toSortExpression('name')).toEqual(['name:asc']);
  });
});

describe('MeilisearchClient.search', () => {
  it('runs hits + two facet queries in one multi-search and maps the results', async () => {
    const multiSearch = vi.fn().mockResolvedValue({
      results: [
        { hits: [{ id: 3 }, { id: 1 }], totalHits: 12 },
        { hits: [], facetDistribution: { 'category.slug': { teclados: 9 } } },
        { hits: [], facetStats: { price_cents: { min: 990, max: 45000 } } },
      ],
    });
    const client = new MeilisearchClient({
      multiSearch,
    } as unknown as Meilisearch);

    const result = await client.search({
      query: 'teclado',
      filters: { categorySlugs: ['teclados'], maxPriceCents: 50000 },
      sort: 'price_asc',
      page: 2,
      perPage: 24,
    });

    expect(result).toEqual({
      ids: [3, 1],
      total: 12,
      facets: { categories: { teclados: 9 }, price: { min: 990, max: 45000 } },
    });
    const [{ queries }] = multiSearch.mock.calls[0]!;
    expect(queries[0]).toMatchObject({
      indexUid: 'products',
      q: 'teclado',
      matchingStrategy: 'all',
      sort: ['price_cents:asc'],
      page: 2,
      hitsPerPage: 24,
    });
    expect(queries[1].facets).toEqual(['category.slug']);
    expect(queries[1].filter).not.toContainEqual(
      expect.stringContaining('category.slug'),
    );
    expect(queries[2].facets).toEqual(['price_cents']);
    expect(queries[2].filter).not.toContainEqual(
      expect.stringContaining('price_cents'),
    );
  });
});

import {
  Meilisearch,
  MeilisearchApiError,
  type EnqueuedTaskPromise,
  type Settings,
} from 'meilisearch';
import type { ProductSort } from '../catalog/dto/product-query.dto.js';
import type { Env } from '../config/env.js';
import {
  SearchClient,
  type ProductDocument,
  type ProductSearchFilters,
  type ProductSearchRequest,
  type ProductSearchResult,
} from './search-client.js';

export const PRODUCTS_INDEX = 'products';

export const PRODUCT_INDEX_SETTINGS: Settings = {
  // Order matters: a match in the name outranks one in the description.
  searchableAttributes: [
    'name',
    'sku',
    'category.name',
    'description',
    'specs',
  ],
  filterableAttributes: [
    'category.slug',
    'price_cents',
    'in_stock',
    'published',
  ],
  sortableAttributes: ['price_cents', 'published_at', 'name'],
  // `sort` first: an explicit sort from the shopper beats relevance; without
  // a sort parameter the rule is a no-op and relevance decides.
  rankingRules: [
    'sort',
    'words',
    'typo',
    'proximity',
    'attribute',
    'exactness',
  ],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
    disableOnAttributes: ['sku'],
  },
};

const BATCH_SIZE = 1000;

export function createMeilisearch(
  env: Pick<Env, 'MEILISEARCH_HOST' | 'MEILISEARCH_KEY'>,
): Meilisearch {
  return new Meilisearch({
    host: env.MEILISEARCH_HOST,
    apiKey: env.MEILISEARCH_KEY,
    // Short request timeout: the catalog falls back to SQL when search is slow.
    timeout: 3_000,
    defaultWaitOptions: { timeout: 60_000, interval: 100 },
  });
}

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/**
 * Filter expressions (AND-ed by Meilisearch). `omit` drops one dimension to
 * compute disjunctive facets for it.
 */
export function toFilterExpression(
  filters: ProductSearchFilters,
  omit?: 'category' | 'price',
): string[] {
  const parts = ['published = true'];
  if (omit !== 'category' && filters.categorySlugs) {
    parts.push(
      `category.slug IN [${filters.categorySlugs.map(quote).join(', ')}]`,
    );
  }
  if (omit !== 'price') {
    if (filters.minPriceCents !== undefined)
      parts.push(`price_cents >= ${filters.minPriceCents}`);
    if (filters.maxPriceCents !== undefined)
      parts.push(`price_cents <= ${filters.maxPriceCents}`);
  }
  if (filters.inStock) parts.push('in_stock = true');
  return parts;
}

export function toSortExpression(sort: ProductSort): string[] | undefined {
  return {
    relevance: undefined,
    newest: ['published_at:desc'],
    price_asc: ['price_cents:asc'],
    price_desc: ['price_cents:desc'],
    name: ['name:asc'],
  }[sort];
}

/** Meilisearch writes are async tasks that report failure in the task, not by rejecting. */
async function succeeded(task: EnqueuedTaskPromise): Promise<void> {
  const result = await task.waitTask();
  if (result.status !== 'succeeded') {
    throw new Error(
      `Meilisearch task ${result.type} ${result.status}: ${result.error?.message ?? 'unknown error'}`,
    );
  }
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE)
    out.push(items.slice(i, i + BATCH_SIZE));
  return out;
}

export class MeilisearchClient extends SearchClient {
  constructor(
    private readonly client: Meilisearch,
    private readonly indexUid: string = PRODUCTS_INDEX,
  ) {
    super();
  }

  private get index() {
    return this.client.index<ProductDocument>(this.indexUid);
  }

  async configure(): Promise<void> {
    const exists = await this.client.getRawIndex(this.indexUid).then(
      () => true,
      (error: unknown) => {
        if (
          error instanceof MeilisearchApiError &&
          error.cause?.code === 'index_not_found'
        )
          return false;
        throw error;
      },
    );
    if (!exists)
      await succeeded(
        this.client.createIndex(this.indexUid, { primaryKey: 'id' }),
      );
    await succeeded(this.index.updateSettings(PRODUCT_INDEX_SETTINGS));
  }

  /**
   * Upsert everything, then delete documents that are no longer published.
   * The index is never empty mid-way, so search keeps working during a reindex.
   */
  async replaceAll(documents: ProductDocument[]): Promise<void> {
    await this.upsert(documents);
    const keep = new Set(documents.map((d) => d.id));
    const stale = (await this.indexedIds()).filter((id) => !keep.has(id));
    await this.remove(stale);
  }

  async upsert(documents: ProductDocument[]): Promise<void> {
    for (const batch of chunks(documents))
      await succeeded(this.index.addDocuments(batch, { primaryKey: 'id' }));
  }

  async remove(ids: number[]): Promise<void> {
    for (const batch of chunks(ids))
      await succeeded(this.index.deleteDocuments(batch));
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchResult> {
    const base = {
      indexUid: this.indexUid,
      q: request.query,
      // Every word must match (typos allowed): precise results and facets.
      matchingStrategy: 'all' as const,
    };
    const { results } = await this.client.multiSearch({
      queries: [
        {
          ...base,
          filter: toFilterExpression(request.filters),
          sort: toSortExpression(request.sort),
          page: request.page,
          hitsPerPage: request.perPage,
          attributesToRetrieve: ['id'],
        },
        {
          ...base,
          filter: toFilterExpression(request.filters, 'category'),
          facets: ['category.slug'],
          limit: 0,
        },
        {
          ...base,
          filter: toFilterExpression(request.filters, 'price'),
          facets: ['price_cents'],
          limit: 0,
        },
      ],
    });
    const [hits, byCategory, byPrice] = results;

    return {
      ids: (hits?.hits ?? []).map((hit) => Number(hit.id)),
      total: hits?.totalHits ?? 0,
      facets: {
        categories: byCategory?.facetDistribution?.['category.slug'] ?? {},
        price: byPrice?.facetStats?.['price_cents'] ?? null,
      },
    };
  }

  private async indexedIds(): Promise<number[]> {
    const ids: number[] = [];
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const page = await this.index.getDocuments({
        fields: ['id'],
        limit: BATCH_SIZE,
        offset,
      });
      ids.push(...page.results.map((d) => d.id));
      if (page.results.length < BATCH_SIZE) return ids;
    }
  }
}

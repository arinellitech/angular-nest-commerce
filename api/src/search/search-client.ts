import type { ProductSort } from '../catalog/dto/product-query.dto.js';

/** What the search index stores per product. Only published + active products are indexed. */
export interface ProductDocument {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  category: { slug: string; name: string } | null;
  price_cents: number;
  in_stock: boolean;
  published: boolean;
  /** Unix seconds, so the engine can sort on it. */
  published_at: number;
  /** `specs` flattened to "key: value" strings so they are searchable. */
  specs: string[];
}

export interface ProductSearchFilters {
  /** Category and its descendants, already resolved by the caller. */
  categorySlugs?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
}

export interface ProductSearchRequest {
  query: string;
  filters: ProductSearchFilters;
  sort: ProductSort;
  page: number;
  perPage: number;
}

export interface ProductSearchResult {
  /** Product ids of the requested page, in ranking order. */
  ids: number[];
  total: number;
  facets: {
    /**
     * Hits per category slug, computed with every filter except the category
     * one, so the storefront can offer the other categories as alternatives.
     */
    categories: Record<string, number>;
    /** Price range of the hits, computed with every filter except the price one. */
    price: { min: number; max: number } | null;
  };
}

/**
 * Port to the search engine. MeilisearchClient is the production adapter; the
 * e2e suite swaps in an in-memory fake (test/helpers/in-memory-search.client.ts)
 * so tests never need a running Meilisearch.
 */
export abstract class SearchClient {
  /** Create the index if needed and apply settings (idempotent). */
  abstract configure(): Promise<void>;
  /** Make the index contain exactly these documents. */
  abstract replaceAll(documents: ProductDocument[]): Promise<void>;
  abstract upsert(documents: ProductDocument[]): Promise<void>;
  abstract remove(ids: number[]): Promise<void>;
  abstract search(request: ProductSearchRequest): Promise<ProductSearchResult>;
}

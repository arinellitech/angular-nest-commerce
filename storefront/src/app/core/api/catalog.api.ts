import { httpResource } from '@angular/common/http';
import type { Category, Product, ProductFilters, ProductPage, Single } from './types';

/** Drop empty values so URLs (and the transfer cache keys) stay clean and shareable. */
export function cleanParams(filters: ProductFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    out[key] = value === true ? '1' : String(value);
  }
  return out;
}

/**
 * Catalog resources. `httpResource` is SSR-aware: the server awaits the
 * request, the response travels in the transfer cache and the browser hydrates
 * without refetching. Call these inside an injection context (field initializer).
 */
export function categoriesResource() {
  return httpResource<{ data: Category[] }>(() => '/api/v1/categories', {
    defaultValue: { data: [] },
  });
}

export function productsResource(filters: () => ProductFilters) {
  return httpResource<ProductPage>(() => ({
    url: '/api/v1/products',
    params: cleanParams(filters()),
  }));
}

/** Header autocomplete: first results for a term; idle while the term is empty. */
export function productSuggestionsResource(term: () => string | undefined, limit = 5) {
  return httpResource<ProductPage>(() => {
    const value = term();
    return value
      ? { url: '/api/v1/products', params: { search: value, per_page: String(limit) } }
      : undefined;
  });
}

export function productResource(slug: () => string | undefined) {
  return httpResource<Single<Product>>(() => {
    const value = slug();
    return value ? `/api/v1/products/${encodeURIComponent(value)}` : undefined;
  });
}

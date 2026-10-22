import { formatMoney } from '../../shared/money';
import type { Category, ProductFacets, ProductFilters } from '../../core/api/types';

/** One row of the category filter. `count` is absent when unknown. */
export interface CategoryOption {
  slug: string;
  name: string;
  count?: number;
  /** 0 = root, 1 = subcategory (indentation only). */
  depth: number;
}

/** Everything the filter panel renders, derived from the URL + API response. */
export interface CatalogFiltersState {
  categories: CategoryOption[];
  category: string | undefined;
  priceBounds: ProductFacets['price'];
  minPrice: number | undefined;
  maxPrice: number | undefined;
  inStock: boolean;
}

/** A removable "active filter" pill. `patch` is what removing it writes to the URL. */
export interface FilterChip {
  label: string;
  patch: Partial<Record<keyof ProductFilters, undefined>>;
}

/** Query-string value → integer cents, ignoring anything malformed. */
export function parseCents(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,9}$/.test(value)) return undefined;
  return Number(value);
}

/** Whole reais typed by the shopper → cents. */
export function reaisToCents(value: string): number | undefined {
  const trimmed = value.trim();
  return /^\d{1,7}$/.test(trimmed) ? Number(trimmed) * 100 : undefined;
}

export function centsToReais(cents: number | undefined): string {
  return cents === undefined ? '' : String(Math.floor(cents / 100));
}

/**
 * With a search, the facets drive the list (only categories with hits, with
 * counts). Without one, the full tree. The selected category always stays
 * visible so the shopper can see what is applied.
 */
export function categoryOptions(
  tree: Category[],
  facets: ProductFacets | undefined,
  selected: string | undefined,
): CategoryOption[] {
  const all = tree.flatMap((root) => [root, ...(root.children ?? [])]);

  if (facets) {
    const options: CategoryOption[] = facets.categories.map((c) => ({ ...c, depth: 0 }));
    if (selected && !options.some((o) => o.slug === selected)) {
      const category = all.find((c) => c.slug === selected);
      if (category) options.unshift({ slug: category.slug, name: category.name, depth: 0 });
    }
    return options;
  }

  return tree.flatMap((root) => [
    { slug: root.slug, name: root.name, count: root.products_count, depth: 0 },
    ...(root.children ?? []).map((child) => ({
      slug: child.slug,
      name: child.name,
      count: child.products_count,
      depth: 1,
    })),
  ]);
}

export function priceLabel(min: number | undefined, max: number | undefined): string | undefined {
  if (min !== undefined && max !== undefined) return `${formatMoney(min)} – ${formatMoney(max)}`;
  if (min !== undefined) return `A partir de ${formatMoney(min)}`;
  if (max !== undefined) return `Até ${formatMoney(max)}`;
  return undefined;
}

export function filterChips(
  filters: ProductFilters,
  categoryName: string | undefined,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.search) chips.push({ label: `“${filters.search}”`, patch: { search: undefined } });
  if (filters.category) {
    chips.push({ label: categoryName ?? filters.category, patch: { category: undefined } });
  }
  const price = priceLabel(filters.min_price, filters.max_price);
  if (price) chips.push({ label: price, patch: { min_price: undefined, max_price: undefined } });
  if (filters.in_stock) chips.push({ label: 'Em estoque', patch: { in_stock: undefined } });
  return chips;
}

import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { categoriesResource, productsResource } from '../../core/api/catalog.api';
import type { ProductFilters, ProductPage, ProductSort } from '../../core/api/types';
import { ProductCard } from '../../shared/ui/product-card';
import { CatalogFilters, type FilterPatch } from './catalog-filters';
import { CatalogFiltersSheet, type CatalogFiltersSheetData } from './catalog-filters-sheet';
import {
  categoryOptions,
  filterChips,
  parseCents,
  type CatalogFiltersState,
} from './catalog-filters.model';

type QueryPatch = Partial<Record<keyof ProductFilters, string | number | boolean | undefined>>;

const SORT_OPTIONS: { label: string; value: ProductSort; searchOnly?: boolean }[] = [
  { label: 'Relevância', value: 'relevance', searchOnly: true },
  { label: 'Mais recentes', value: 'newest' },
  { label: 'Menor preço', value: 'price_asc' },
  { label: 'Maior preço', value: 'price_desc' },
  { label: 'Nome', value: 'name' },
];

/**
 * Filters live in the URL (query params bound to inputs via
 * withComponentInputBinding) so results are shareable and cacheable. With a
 * search the API returns facets, which drive the category list and price hint.
 */
@Component({
  selector: 'app-product-list',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatPaginatorModule,
    ProductCard,
    CatalogFilters,
  ],
  templateUrl: './product-list.html',
})
export class ProductList {
  private readonly router = inject(Router);
  private readonly bottomSheet = inject(MatBottomSheet);

  // Query params → inputs (withComponentInputBinding). Strings because they come from the URL.
  readonly search = input<string>();
  readonly category = input<string>();
  readonly sort = input<ProductSort>();
  readonly min_price = input<string>();
  readonly max_price = input<string>();
  readonly in_stock = input<string>();
  readonly page = input<string>();

  readonly filters = computed<ProductFilters>(() => ({
    search: this.search()?.trim() || undefined,
    category: this.category() || undefined,
    sort: this.sort(),
    min_price: parseCents(this.min_price()),
    max_price: parseCents(this.max_price()),
    in_stock: this.in_stock() === '1' ? true : undefined,
    page: this.page() ? Number(this.page()) : undefined,
    per_page: 24,
  }));

  readonly products = productsResource(() => this.filters());
  private readonly categoriesRes = categoriesResource();

  /** Last loaded page, kept while the next one loads so the grid and facets don't flash. */
  readonly result = linkedSignal<{ page?: ProductPage; loading: boolean }, ProductPage | undefined>(
    {
      source: () => ({
        page: this.products.hasValue() ? this.products.value() : undefined,
        loading: this.products.isLoading(),
      }),
      computation: ({ page, loading }, previous) => page ?? (loading ? previous?.value : undefined),
    },
  );

  private readonly tree = computed(() => this.categoriesRes.value().data);

  readonly categoryName = computed(() => {
    const slug = this.filters().category;
    return this.tree()
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.slug === slug)?.name;
  });

  readonly title = computed(() => {
    const search = this.filters().search;
    if (search) return `Resultados para “${search}”`;
    return this.categoryName() ?? 'Produtos';
  });

  readonly resultsLabel = computed(() => {
    const total = this.result()?.meta.total;
    if (total === undefined) return '';
    return total === 1 ? '1 produto' : `${total} produtos`;
  });

  readonly sortOptions = computed(() =>
    SORT_OPTIONS.filter((o) => !o.searchOnly || this.filters().search),
  );

  /** Mirrors the API default so the select never shows an empty value. */
  readonly effectiveSort = computed<ProductSort>(() => {
    const { sort, search } = this.filters();
    if (sort && (sort !== 'relevance' || search)) return sort;
    return search ? 'relevance' : 'newest';
  });

  readonly filtersState = computed<CatalogFiltersState>(() => {
    const filters = this.filters();
    const facets = this.result()?.meta.facets;
    return {
      categories: categoryOptions(this.tree(), facets, filters.category),
      category: filters.category,
      priceBounds: facets?.price ?? null,
      minPrice: filters.min_price,
      maxPrice: filters.max_price,
      inStock: !!filters.in_stock,
    };
  });

  readonly chips = computed(() => filterChips(this.filters(), this.categoryName()));
  /** Badge on the mobile "Filtros" button: the search term is not a panel filter. */
  readonly panelFilterCount = computed(
    () => this.chips().filter((chip) => !('search' in chip.patch)).length,
  );

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  update(patch: QueryPatch | FilterPatch): void {
    const queryParams: Record<string, string | number | undefined> = { page: undefined };
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === true ? '1' : value === false ? undefined : value;
    }
    void this.router.navigate(['/products'], { queryParams, queryParamsHandling: 'merge' });
  }

  clearAll(): void {
    this.update({
      search: undefined,
      category: undefined,
      min_price: undefined,
      max_price: undefined,
      in_stock: undefined,
    });
  }

  onPage(event: PageEvent): void {
    void this.router.navigate(['/products'], {
      queryParams: { page: event.pageIndex + 1 },
      queryParamsHandling: 'merge',
    });
  }

  openFilters(): void {
    this.bottomSheet.open<CatalogFiltersSheet, CatalogFiltersSheetData>(CatalogFiltersSheet, {
      ariaLabel: 'Filtros',
      data: {
        state: this.filtersState,
        total: computed(() => this.result()?.meta.total),
        change: (patch) => this.update(patch),
      },
    });
  }
}

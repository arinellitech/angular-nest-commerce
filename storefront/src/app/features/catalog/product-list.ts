import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { categoriesResource, productsResource } from '../../core/api/catalog.api';
import type { ProductFilters, ProductSort } from '../../core/api/types';
import { ProductCard } from '../../shared/ui/product-card';

/**
 * Filters live in the URL (query params bound to inputs via
 * withComponentInputBinding) so results are shareable and cacheable.
 */
@Component({
  selector: 'app-product-list',
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatPaginatorModule,
    ProductCard,
  ],
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-semibold">{{ title() }}</h1>
          @if (products.value(); as page) {
            <p class="text-sm text-zinc-500">{{ page.meta.total }} resultados</p>
          }
        </div>

        <div class="flex items-center gap-4">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-48">
            <mat-label>Ordenar</mat-label>
            <mat-select [value]="filters().sort" (selectionChange)="update({ sort: $event.value })">
              @for (option of sortOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-checkbox
            [checked]="!!filters().in_stock"
            (change)="update({ in_stock: $event.checked || undefined })"
          >
            Só em estoque
          </mat-checkbox>
        </div>
      </div>

      @if (products.isLoading() && !products.hasValue()) {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          @for (n of skeletons; track n) {
            <div class="aspect-square animate-pulse rounded-lg bg-zinc-100"></div>
          }
        </div>
      } @else if (products.error()) {
        <p class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Não foi possível carregar o catálogo. Tente novamente.
        </p>
      } @else if (products.value()?.data?.length) {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          @for (product of products.value()!.data; track product.id) {
            <app-product-card [product]="product" />
          }
        </div>

        @if (products.value()!.meta.last_page > 1) {
          <mat-paginator
            class="mt-10"
            [length]="products.value()!.meta.total"
            [pageSize]="products.value()!.meta.per_page"
            [pageIndex]="products.value()!.meta.current_page - 1"
            [hidePageSize]="true"
            (page)="onPage($event)"
            aria-label="Paginação"
          />
        }
      } @else {
        <div class="rounded-md border border-zinc-200 p-8 text-center">
          <h2 class="font-medium">Nenhum produto encontrado</h2>
          <p class="text-sm text-zinc-500">Tente outra busca ou remova os filtros.</p>
        </div>
      }
    </div>
  `,
})
export class ProductList {
  private readonly router = inject(Router);

  // Query params → inputs (withComponentInputBinding). Strings because they come from the URL.
  readonly search = input<string>();
  readonly category = input<string>();
  readonly sort = input<ProductSort>();
  readonly in_stock = input<string>();
  readonly page = input<string>();

  readonly filters = computed<ProductFilters>(() => ({
    search: this.search() || undefined,
    category: this.category() || undefined,
    sort: this.sort() ?? 'newest',
    in_stock: this.in_stock() === '1' ? true : undefined,
    page: this.page() ? Number(this.page()) : undefined,
    per_page: 24,
  }));

  readonly products = productsResource(() => this.filters());
  private readonly categoriesRes = categoriesResource();

  readonly title = computed(() => {
    const slug = this.filters().category;
    const name = this.categoriesRes
      .value()
      .data.flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.slug === slug)?.name;
    if (name) return name;
    return this.filters().search ? `Busca: ${this.filters().search}` : 'Produtos';
  });

  readonly sortOptions: { label: string; value: ProductSort }[] = [
    { label: 'Mais recentes', value: 'newest' },
    { label: 'Menor preço', value: 'price_asc' },
    { label: 'Maior preço', value: 'price_desc' },
    { label: 'Nome', value: 'name' },
  ];
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];

  update(patch: Record<string, string | boolean | number | undefined>): void {
    const queryParams: Record<string, string | number | undefined> = { page: undefined };
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === true ? '1' : value === false ? undefined : value;
    }
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  onPage(event: PageEvent): void {
    void this.router.navigate([], {
      queryParams: { page: event.pageIndex + 1 },
      queryParamsHandling: 'merge',
    });
  }
}

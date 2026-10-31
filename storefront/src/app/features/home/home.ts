import { Component, computed, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { categoriesResource, productsResource } from '../../core/api/catalog.api';
import { ProductCard } from '../../shared/ui/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, ProductCard],
  template: `
    <section class="bg-zinc-50">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div class="max-w-2xl">
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
            Headless commerce, do jeito certo.
          </h1>
          <p class="mt-4 text-lg text-zinc-600">
            Catálogo com SSR e cache na borda, carrinho com estoque reservado, checkout com Pix e
            webhooks idempotentes.
          </p>
          <div class="mt-8">
            <a mat-flat-button routerLink="/products">Ver produtos</a>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-12">
      <div class="mb-6 flex items-end justify-between">
        <h2 class="text-2xl font-semibold">Novidades</h2>
        <a routerLink="/products" class="text-sm font-medium text-emerald-700 hover:underline"
          >Ver todos →</a
        >
      </div>

      @if (newest.isLoading()) {
        <div class="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 sm:gap-x-3 lg:grid-cols-4" aria-busy="true">
          @for (n of skeletons; track n) {
            <div class="p-2">
              <div class="aspect-square animate-pulse rounded-lg bg-zinc-100"></div>
              <div class="space-y-2 px-1.5 pt-3">
                <div class="h-4 w-11/12 animate-pulse rounded bg-zinc-100"></div>
                <div class="h-4 w-2/3 animate-pulse rounded bg-zinc-100"></div>
                <div class="h-7 mt-4! w-1/2 animate-pulse rounded bg-zinc-100"></div>
              </div>
            </div>
          }
        </div>
      } @else if (newest.error()) {
        <p class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Não foi possível carregar os produtos agora.
        </p>
      } @else {
        <div class="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 sm:gap-x-3 lg:grid-cols-4">
          @for (product of newest.value()?.data; track product.id) {
            <app-product-card [product]="product" [priority]="$index < 4" />
          }
        </div>
      }
    </section>

    @if (categories().length) {
      <section class="mx-auto max-w-7xl px-4 pb-16">
        <h2 class="mb-6 text-2xl font-semibold">Categorias</h2>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          @for (category of categories(); track category.id) {
            <a
              [routerLink]="['/products']"
              [queryParams]="{ category: category.slug }"
              class="rounded-lg border border-zinc-200 p-4 transition hover:border-emerald-400 hover:shadow-sm"
            >
              <h3 class="font-medium">{{ category.name }}</h3>
              <p class="text-sm text-zinc-500">{{ category.products_count }} produtos</p>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class Home {
  private readonly meta = inject(Meta);

  readonly newest = productsResource(() => ({ sort: 'newest', per_page: 8 }));
  private readonly categoriesRes = categoriesResource();
  readonly categories = computed(() => this.categoriesRes.value().data);
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content:
        'Loja demo headless: Angular 22 na Vercel, NestJS 12 como API, PostgreSQL no Supabase.',
    });
  }
}

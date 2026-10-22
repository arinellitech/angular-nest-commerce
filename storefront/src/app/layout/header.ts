import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { categoriesResource } from '../core/api/catalog.api';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  template: `
    <header class="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <a routerLink="/" class="text-lg font-bold tracking-tight text-zinc-900">
          Loja<span class="text-emerald-600">Demo</span>
        </a>

        <nav class="hidden items-center gap-4 md:flex" aria-label="Categorias">
          @for (category of categories(); track category.id) {
            <a
              [routerLink]="['/products']"
              [queryParams]="{ category: category.slug }"
              routerLinkActive="text-emerald-700"
              class="text-sm text-zinc-600 hover:text-zinc-900"
            >
              {{ category.name }}
            </a>
          }
        </nav>

        <form class="ml-auto hidden sm:block" role="search" (submit)="submitSearch($event)">
          <label class="sr-only" for="header-search">Buscar produtos</label>
          <input
            id="header-search"
            type="search"
            name="search"
            placeholder="Buscar produtos…"
            autocomplete="off"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            class="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </form>

        <!-- Cart badge is wired in PROMPT 02 (CartStore). -->
        <a mat-icon-button routerLink="/cart" aria-label="Carrinho">
          <mat-icon>shopping_bag</mat-icon>
        </a>
      </div>
    </header>
  `,
})
export class Header {
  private readonly router = inject(Router);
  private readonly categoriesRes = categoriesResource();

  readonly categories = computed(() => this.categoriesRes.value().data);
  readonly search = signal('');

  submitSearch(event: Event): void {
    event.preventDefault();
    const term = this.search().trim();
    if (term) void this.router.navigate(['/products'], { queryParams: { search: term } });
  }
}

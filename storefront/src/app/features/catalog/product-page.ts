import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import {
  Component,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { productResource } from '../../core/api/catalog.api';
import { PriceTag } from '../../shared/ui/price-tag';

@Component({
  selector: 'app-product-page',
  imports: [RouterLink, NgOptimizedImage, MatButtonModule, MatIconModule, PriceTag],
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10">
      @if (resource.isLoading() && !resource.hasValue()) {
        <div class="grid gap-10 lg:grid-cols-2" aria-busy="true">
          <div class="aspect-square animate-pulse rounded-lg bg-zinc-100"></div>
          <div class="space-y-4">
            <div class="h-8 w-2/3 animate-pulse rounded bg-zinc-100"></div>
            <div class="h-6 w-1/3 animate-pulse rounded bg-zinc-100"></div>
          </div>
        </div>
      } @else if (notFound()) {
        <div class="py-24 text-center">
          <p class="text-6xl font-bold text-emerald-600">404</p>
          <h1 class="mt-4 text-2xl font-semibold">Produto não encontrado</h1>
          <a mat-stroked-button routerLink="/products" class="mt-8">Voltar para o catálogo</a>
        </div>
      } @else if (product(); as product) {
        <nav class="mb-8 text-sm text-zinc-500" aria-label="Breadcrumb">
          <a routerLink="/" class="hover:underline">Início</a> ›
          <a routerLink="/products" class="hover:underline">Produtos</a> ›
          @if (product.category; as category) {
            <a
              [routerLink]="['/products']"
              [queryParams]="{ category: category.slug }"
              class="hover:underline"
              >{{ category.name }}</a
            >
            ›
          }
          <span class="text-zinc-900">{{ product.name }}</span>
        </nav>

        <div class="grid gap-10 lg:grid-cols-2">
          <div>
            <div class="aspect-square overflow-hidden rounded-lg bg-zinc-100">
              @if (product.images?.[selectedImage()]; as image) {
                <img
                  [ngSrc]="image.url"
                  [alt]="image.alt ?? product.name"
                  width="900"
                  height="900"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  class="size-full object-cover"
                />
              }
            </div>
            @if ((product.images?.length ?? 0) > 1) {
              <div class="mt-3 flex gap-2" role="list">
                @for (image of product.images; track image.id; let i = $index) {
                  <button
                    type="button"
                    class="size-16 overflow-hidden rounded-md border"
                    [class.border-emerald-500]="i === selectedImage()"
                    [class.border-zinc-200]="i !== selectedImage()"
                    [attr.aria-label]="'Imagem ' + (i + 1)"
                    [attr.aria-pressed]="i === selectedImage()"
                    (click)="selectedImage.set(i)"
                  >
                    <img
                      [ngSrc]="image.url"
                      [alt]="image.alt ?? ''"
                      width="96"
                      height="96"
                      class="size-full object-cover"
                    />
                  </button>
                }
              </div>
            }
          </div>

          <div>
            @if (product.category; as category) {
              <p class="text-sm uppercase tracking-wide text-zinc-500">{{ category.name }}</p>
            }
            <h1 class="mt-1 text-3xl font-semibold">{{ product.name }}</h1>
            <p class="mt-1 text-xs text-zinc-500">SKU {{ product.sku }}</p>

            <app-price-tag
              [price]="product.price"
              [compareAt]="product.compare_at_price"
              size="lg"
              class="mt-6 block"
            />

            <p class="mt-6 whitespace-pre-line text-zinc-600">{{ product.description }}</p>

            <div class="mt-8 flex items-center gap-3">
              <label class="sr-only" for="quantity">Quantidade</label>
              <input
                id="quantity"
                type="number"
                min="1"
                [max]="product.available_quantity ?? 99"
                [value]="quantity()"
                (input)="quantity.set(+$any($event.target).value || 1)"
                [disabled]="product.in_stock === false"
                class="w-24 rounded-md border border-zinc-300 px-3 py-2"
              />
              <button mat-flat-button [disabled]="product.in_stock === false" (click)="addToCart()">
                <mat-icon>shopping_bag</mat-icon>
                {{ product.in_stock === false ? 'Esgotado' : 'Adicionar ao carrinho' }}
              </button>
            </div>

            @if (product.in_stock && (product.available_quantity ?? 0) <= 5) {
              <p class="mt-3 text-sm text-amber-700">
                Últimas {{ product.available_quantity }} unidades.
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ProductPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly snackBar = inject(MatSnackBar);
  /** Server only: lets the SSR response carry a real 404 status for unknown slugs. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /** Route param → input (withComponentInputBinding). */
  readonly slug = input.required<string>();

  readonly resource = productResource(() => this.slug());
  readonly product = computed(() => this.resource.value()?.data);
  readonly notFound = computed(() => {
    const error = this.resource.error() as { status?: number } | undefined;
    return error?.status === 404;
  });

  readonly selectedImage = signal(0);
  readonly quantity = signal(1);

  constructor() {
    effect(() => {
      if (this.notFound() && this.responseInit) this.responseInit.status = 404;
    });

    // SEO: title/description + schema.org Product (JSON-LD) once the product is loaded.
    effect(() => {
      const product = this.product();
      if (!product) return;
      untracked(() => {
        this.title.setTitle(`${product.name} · Loja Demo`);
        this.meta.updateTag({
          name: 'description',
          content: product.description?.slice(0, 160) ?? product.name,
        });
        if (product.images?.[0])
          this.meta.updateTag({ property: 'og:image', content: product.images[0].url });
        this.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          sku: product.sku,
          description: product.description ?? undefined,
          image: product.images?.map((i) => i.url),
          offers: {
            '@type': 'Offer',
            price: (product.price.amount / 100).toFixed(2),
            priceCurrency: product.price.currency,
            availability: product.in_stock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        });
      });
    });
  }

  // PROMPT 02 replaces this with inject(CartStore).addItem(product, quantity).
  addToCart(): void {
    this.snackBar.open('Carrinho ainda não implementado — rode o PROMPT 02.', 'OK', {
      duration: 4000,
    });
  }

  private injectJsonLd(data: Record<string, unknown>): void {
    const id = 'product-jsonld';
    let script = this.document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}

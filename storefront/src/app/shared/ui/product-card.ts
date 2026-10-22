import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/api/types';
import { PriceTag } from './price-tag';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, NgOptimizedImage, PriceTag],
  template: `
    <a
      [routerLink]="['/products', product().slug]"
      class="group block overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:shadow-md"
    >
      <div class="relative aspect-square overflow-hidden bg-zinc-100">
        @if (image(); as img) {
          <img
            [ngSrc]="img.url"
            [priority]="priority()"
            [alt]="img.alt ?? product().name"
            width="600"
            height="600"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        } @else {
          <div class="flex size-full items-center justify-center text-zinc-400">
            <span class="material-symbols-outlined text-5xl" aria-hidden="true">image</span>
          </div>
        }
        @if (product().in_stock === false) {
          <span
            class="absolute left-2 top-2 rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white"
          >
            Esgotado
          </span>
        }
      </div>
      <div class="space-y-1 p-4">
        @if (product().category; as category) {
          <p class="text-xs uppercase tracking-wide text-zinc-500">{{ category.name }}</p>
        }
        <h3 class="line-clamp-2 font-medium text-zinc-900">{{ product().name }}</h3>
        <app-price-tag [price]="product().price" [compareAt]="product().compare_at_price" />
      </div>
    </a>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  /** First row of a grid: the LCP candidate, preloaded by NgOptimizedImage. */
  readonly priority = input(false);
  readonly image = computed(() => this.product().images?.[0]);
}

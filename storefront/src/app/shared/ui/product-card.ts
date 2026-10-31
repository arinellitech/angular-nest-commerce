import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/api/types';
import { PriceTag } from './price-tag';

/** At or below this many units the card shows a "só restam N" nudge. */
const LOW_STOCK = 5;

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, NgOptimizedImage, PriceTag],
  host: { class: 'block h-full' },
  template: `
    <a
      [routerLink]="['/products', product().slug]"
      class="group flex h-full flex-col rounded-xl bg-white p-2 transition-[box-shadow,translate] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgb(24_24_27/0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div class="relative aspect-square shrink-0 overflow-hidden rounded-lg bg-zinc-50">
        @if (image(); as img) {
          <img
            [ngSrc]="img.url"
            [priority]="priority()"
            [alt]="img.alt ?? product().name"
            width="600"
            height="600"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            class="size-full object-contain p-[6%] mix-blend-multiply transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
            [class.opacity-50]="soldOut()"
            [class.grayscale]="soldOut()"
          />
        } @else {
          <div class="flex size-full items-center justify-center text-zinc-300">
            <span class="material-symbols-outlined text-5xl" aria-hidden="true">image</span>
          </div>
        }
        @if (soldOut()) {
          <span
            class="absolute left-2 top-2 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
          >
            Esgotado
          </span>
        }
      </div>

      <div class="flex flex-1 flex-col px-1.5 pb-1.5 pt-3">
        <!-- Reserves two title lines + category so prices line up across a row. -->
        <div class="min-h-14.5">
          <h3
            class="line-clamp-2 text-sm/5 text-zinc-900 decoration-emerald-700/40 underline-offset-2 group-hover:text-emerald-800 group-hover:underline"
          >
            {{ product().name }}
          </h3>
          @if (product().category; as category) {
            <p class="mt-0.5 truncate text-xs text-zinc-500">em {{ category.name }}</p>
          }
        </div>

        <app-price-tag
          class="mt-3 block"
          [price]="product().price"
          [compareAt]="product().compare_at_price"
        />

        @if (lowStock(); as left) {
          <p class="mt-2 text-xs font-medium text-amber-700">
            Só {{ left === 1 ? 'resta 1' : 'restam ' + left }} em estoque
          </p>
        }
      </div>
    </a>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  /** First row of a grid: the LCP candidate, preloaded by NgOptimizedImage. */
  readonly priority = input(false);
  readonly image = computed(() => this.product().images?.[0]);
  readonly soldOut = computed(() => this.product().in_stock === false);
  readonly lowStock = computed(() => {
    const { in_stock, available_quantity: left } = this.product();
    return in_stock && left !== null && left > 0 && left <= LOW_STOCK ? left : null;
  });
}

import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Cart } from '../../core/api/types';

/** Read-only cart recap beside the checkout steps. */
@Component({
  selector: 'app-checkout-summary',
  imports: [NgOptimizedImage, MatIconModule],
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="checkout-summary-title"
      class="rounded-lg border border-zinc-200 bg-zinc-50 p-5 sm:p-6"
    >
      <h2 id="checkout-summary-title" class="text-lg font-semibold text-zinc-900">Seu pedido</h2>

      <ul class="mt-4 space-y-4">
        @for (item of cart().items; track item.id) {
          <li class="flex items-center gap-3">
            <div
              class="relative size-14 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-zinc-200"
            >
              @if (item.product.images?.[0]; as image) {
                <img
                  [ngSrc]="image.url"
                  [alt]="image.alt ?? ''"
                  width="56"
                  height="56"
                  class="size-full object-cover"
                />
              } @else {
                <span class="grid size-full place-items-center text-zinc-400" aria-hidden="true">
                  <mat-icon>image</mat-icon>
                </span>
              }
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-zinc-900">{{ item.product.name }}</p>
              <p class="text-sm text-zinc-600 tabular-nums">
                {{ item.quantity }} × {{ item.unit_price.formatted }}
              </p>
            </div>
            <p class="text-sm font-medium text-zinc-900 tabular-nums">{{ item.total.formatted }}</p>
          </li>
        }
      </ul>

      <dl class="mt-5 space-y-2.5 border-t border-zinc-200 pt-5 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-zinc-600">Subtotal</dt>
          <dd class="text-zinc-900 tabular-nums">{{ cart().subtotal.formatted }}</dd>
        </div>
        @if (cart().coupon; as coupon) {
          <div class="flex justify-between gap-4">
            <dt class="text-zinc-600">Desconto ({{ coupon.code }})</dt>
            <dd class="text-emerald-800 tabular-nums">− {{ coupon.discount.formatted }}</dd>
          </div>
        }
        <div class="flex justify-between gap-4">
          <dt class="text-zinc-600">Frete</dt>
          <dd class="text-zinc-900 tabular-nums">
            {{ cart().shipping.amount === 0 ? 'Grátis' : cart().shipping.formatted }}
          </dd>
        </div>
      </dl>

      <div class="mt-5 flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-5">
        <span class="font-medium text-zinc-900">Total</span>
        <span class="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
          {{ cart().total.formatted }}
        </span>
      </div>
    </section>
  `,
})
export class CheckoutSummary {
  readonly cart = input.required<Cart>();
}

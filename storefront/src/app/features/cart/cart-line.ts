import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { CartItem } from '../../core/api/types';
import { QuantityStepper } from '../../shared/ui/quantity-stepper';

@Component({
  selector: 'app-cart-line',
  imports: [NgOptimizedImage, RouterLink, MatIconModule, QuantityStepper],
  host: { class: 'block' },
  template: `
    <div class="flex gap-4 py-5 sm:gap-6" [class.opacity-60]="busy()">
      <a
        [routerLink]="['/products', item().product.slug]"
        class="block size-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 sm:size-24"
        [attr.aria-label]="item().product.name"
        tabindex="-1"
      >
        @if (image(); as image) {
          <img
            [ngSrc]="image.url"
            [alt]="image.alt ?? ''"
            width="96"
            height="96"
            class="size-full object-cover"
          />
        } @else {
          <span class="grid size-full place-items-center text-zinc-400" aria-hidden="true">
            <mat-icon>image</mat-icon>
          </span>
        }
      </a>

      <div class="grid min-w-0 flex-1 gap-x-6 gap-y-3 sm:grid-cols-[1fr_auto]">
        <div class="min-w-0">
          <a
            [routerLink]="['/products', item().product.slug]"
            class="font-medium text-zinc-900 hover:underline"
            >{{ item().product.name }}</a
          >
          <p class="mt-0.5 text-sm text-zinc-600 tabular-nums">
            {{ item().unit_price.formatted }} cada
          </p>
          @if (error(); as error) {
            <p class="mt-2 text-sm text-rose-700" role="alert">{{ error }}</p>
          } @else if (shortOfStock()) {
            <p class="mt-2 text-sm text-rose-700">
              @if (item().available_quantity === 0) {
                Este produto não está mais disponível. Remova-o para continuar.
              } @else {
                Só temos {{ item().available_quantity }}
                {{ item().available_quantity === 1 ? 'unidade' : 'unidades' }}. Ajuste a quantidade
                para continuar.
              }
            </p>
          }
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:flex-col sm:flex-nowrap sm:items-end sm:justify-start"
        >
          <p class="text-base font-semibold text-zinc-900 tabular-nums sm:order-first">
            {{ item().total.formatted }}
          </p>
          <div class="flex items-center gap-2">
            <app-quantity-stepper
              [quantity]="item().quantity"
              [max]="item().available_quantity"
              [busy]="busy()"
              [disabled]="busy()"
              [label]="'Quantidade de ' + item().product.name"
              (quantityChange)="quantityChange.emit($event)"
            />
            <button
              type="button"
              class="grid size-10 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40"
              [attr.aria-label]="'Remover ' + item().product.name + ' do carrinho'"
              [disabled]="busy()"
              (click)="remove.emit()"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CartLine {
  readonly item = input.required<CartItem>();
  /** Message from the last failed change of this line. */
  readonly error = input<string | undefined>(undefined);
  readonly busy = input(false);

  readonly quantityChange = output<number>();
  readonly remove = output<void>();

  protected readonly image = computed(() => this.item().product.images?.[0]);
  protected readonly shortOfStock = computed(
    () => this.item().quantity > this.item().available_quantity,
  );
}

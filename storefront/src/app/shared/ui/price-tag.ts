import { Component, computed, input } from '@angular/core';
import type { Money } from '../../core/api/types';
import { discountPercent } from '../money';

@Component({
  selector: 'app-price-tag',
  template: `
    <div class="flex flex-wrap items-baseline gap-2">
      <span class="font-semibold" [class]="size() === 'lg' ? 'text-3xl' : 'text-base'">
        {{ price().formatted }}
      </span>
      @if (compareAt() && percent()) {
        <span class="text-sm text-zinc-500 line-through">{{ compareAt()!.formatted }}</span>
        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
          -{{ percent() }}%
        </span>
      }
    </div>
  `,
})
export class PriceTag {
  readonly price = input.required<Money>();
  readonly compareAt = input<Money | undefined>(undefined);
  readonly size = input<'sm' | 'lg'>('sm');

  readonly percent = computed(() => discountPercent(this.price().amount, this.compareAt()?.amount));
}

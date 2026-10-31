import { Component, computed, input } from '@angular/core';
import type { Money } from '../../core/api/types';
import { discountPercent, moneyParts } from '../money';

/**
 * Retail price block: `-20%  R$ 199⁹⁰` with the compare-at price struck below.
 * The split visual is aria-hidden; screen readers get one plain sentence.
 */
@Component({
  selector: 'app-price-tag',
  template: `
    <p class="sr-only">
      {{ price().formatted }}
      @if (percent()) {
        , antes {{ compareAt()!.formatted }}, {{ percent() }}% de desconto
      }
    </p>
    <div aria-hidden="true">
      <div
        class="flex flex-wrap items-start gap-x-2 gap-y-1 leading-none"
        [class]="size() === 'lg' ? 'text-[2.25rem]' : 'text-[1.375rem] sm:text-[1.625rem]'"
      >
        @if (percent()) {
          <span class="font-light tracking-tight text-rose-700">-{{ percent() }}%</span>
        }
        <span class="flex items-start font-medium tracking-tight text-zinc-900 tabular-nums">
          <span class="mr-0.5 mt-[0.18em] text-[0.46em]">{{ parts().symbol }}</span>
          <span>{{ parts().whole }}</span>
          <span class="mt-[0.18em] text-[0.46em]">{{ parts().fraction }}</span>
        </span>
      </div>
      @if (percent()) {
        <p class="mt-1.5 text-zinc-500" [class]="size() === 'lg' ? 'text-sm' : 'text-xs'">
          De: <span class="line-through">{{ compareAt()!.formatted }}</span>
        </p>
      }
    </div>
  `,
})
export class PriceTag {
  readonly price = input.required<Money>();
  readonly compareAt = input<Money | undefined>(undefined);
  readonly size = input<'sm' | 'lg'>('sm');

  readonly percent = computed(() => discountPercent(this.price().amount, this.compareAt()?.amount));
  readonly parts = computed(() => moneyParts(this.price().amount, this.price().currency));
}

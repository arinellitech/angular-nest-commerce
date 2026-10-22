import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField, pattern, submit, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { ProductFacets, ProductFilters } from '../../core/api/types';
import { centsToReais, reaisToCents, type CategoryOption } from './catalog-filters.model';

export type FilterPatch = Partial<Pick<ProductFilters, 'min_price' | 'max_price' | 'in_stock'>>;

const WHOLE_REAIS = /^\d{0,7}$/;

/**
 * Category, price and stock filters. Categories are links (shareable,
 * crawlable URLs); price and stock are emitted for the page to write into the
 * URL. Rendered in the desktop sidebar and in the mobile bottom sheet.
 */
@Component({
  selector: 'app-catalog-filters',
  imports: [RouterLink, FormField, MatButtonModule, MatCheckboxModule],
  templateUrl: './catalog-filters.html',
})
export class CatalogFilters {
  readonly categories = input.required<CategoryOption[]>();
  readonly selected = input<string>();
  readonly priceBounds = input<ProductFacets['price']>(null);
  /** Cents, as in the URL. */
  readonly minPrice = input<number>();
  readonly maxPrice = input<number>();
  readonly inStock = input(false);
  /** Keeps ids unique: the sidebar and the bottom sheet can both be in the DOM. */
  readonly idPrefix = input('filters');

  readonly changed = output<FilterPatch>();

  /** Whole reais as typed; reset whenever the URL changes. */
  protected readonly priceModel = linkedSignal(() => ({
    min: centsToReais(this.minPrice()),
    max: centsToReais(this.maxPrice()),
  }));

  protected readonly priceForm = form(this.priceModel, (p) => {
    pattern(p.min, WHOLE_REAIS, { message: 'Use apenas reais inteiros, sem centavos.' });
    pattern(p.max, WHOLE_REAIS, { message: 'Use apenas reais inteiros, sem centavos.' });
    validate(p.max, ({ value, valueOf }) => {
      const min = reaisToCents(valueOf(p.min));
      const max = reaisToCents(value());
      return min !== undefined && max !== undefined && max < min
        ? { kind: 'range', message: 'O máximo precisa ser maior que o mínimo.' }
        : undefined;
    });
  });

  protected readonly priceError = computed(() => {
    for (const field of [this.priceForm.min(), this.priceForm.max()]) {
      if (field.touched() && field.invalid()) return field.errors()[0]?.message;
    }
    return undefined;
  });

  /** Error or range hint below the price inputs, when one is shown. */
  protected readonly priceHintId = computed(() =>
    this.priceError() || this.priceBounds() ? `${this.idPrefix()}-price-hint` : null,
  );

  protected readonly minPlaceholder = computed(() => {
    const bounds = this.priceBounds();
    return bounds ? centsToReais(bounds.min.amount) : '0';
  });

  protected readonly maxPlaceholder = computed(() => {
    const bounds = this.priceBounds();
    return bounds ? String(Math.ceil(bounds.max.amount / 100)) : '';
  });

  protected rowClass(active: boolean, depth = 0): string {
    const base =
      'flex items-center justify-between gap-3 rounded-md py-1.5 pr-2.5 text-sm transition-colors';
    const indent = depth > 0 ? 'pl-6' : 'pl-2.5';
    const state = active
      ? 'bg-emerald-50 font-semibold text-emerald-800'
      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900';
    return `${base} ${indent} ${state}`;
  }

  protected showError(invalid: boolean, touched: boolean): 'true' | null {
    return invalid && touched ? 'true' : null;
  }

  protected applyPrice(event: Event): void {
    event.preventDefault();
    void submit(this.priceForm, async () => {
      const { min, max } = this.priceModel();
      this.changed.emit({ min_price: reaisToCents(min), max_price: reaisToCents(max) });
    });
  }

  protected clearPrice(): void {
    this.changed.emit({ min_price: undefined, max_price: undefined });
  }
}

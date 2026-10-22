import { Component, computed, inject, type Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { CatalogFilters, type FilterPatch } from './catalog-filters';
import type { CatalogFiltersState } from './catalog-filters.model';

export interface CatalogFiltersSheetData {
  /** Live state: the sheet stays open while the URL (and results) update behind it. */
  state: Signal<CatalogFiltersState>;
  total: Signal<number | undefined>;
  change: (patch: FilterPatch) => void;
}

/** Mobile container for the filters (MatBottomSheet). */
@Component({
  selector: 'app-catalog-filters-sheet',
  imports: [CatalogFilters, MatButtonModule, MatIconModule],
  template: `
    <div class="flex items-center justify-between pb-2">
      <h2 class="text-lg font-semibold text-zinc-900">Filtros</h2>
      <button mat-icon-button type="button" aria-label="Fechar filtros" (click)="close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    @let state = data.state();
    <app-catalog-filters
      idPrefix="sheet"
      [categories]="state.categories"
      [selected]="state.category"
      [priceBounds]="state.priceBounds"
      [minPrice]="state.minPrice"
      [maxPrice]="state.maxPrice"
      [inStock]="state.inStock"
      (changed)="data.change($event)"
    />

    <div class="sticky bottom-0 -mx-4 mt-6 border-t border-zinc-200 bg-white px-4 py-3">
      <button mat-flat-button type="button" class="w-full" (click)="close()">
        {{ showLabel() }}
      </button>
    </div>
  `,
})
export class CatalogFiltersSheet {
  protected readonly data = inject<CatalogFiltersSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject(MatBottomSheetRef<CatalogFiltersSheet>);

  protected readonly showLabel = computed(() => {
    const total = this.data.total();
    if (total === undefined) return 'Ver resultados';
    return total === 1 ? 'Ver 1 resultado' : `Ver ${total} resultados`;
  });

  protected close(): void {
    this.ref.dismiss();
  }
}

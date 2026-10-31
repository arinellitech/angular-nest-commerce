import { Component, effect, input, linkedSignal, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Quantity control: − [ n ] +. Buttons commit immediately; a typed value
 * commits on blur/Enter. The parent owns the real quantity: if it rejects a
 * change (stock), the field falls back to `quantity` once `busy` ends.
 */
@Component({
  selector: 'app-quantity-stepper',
  imports: [MatIconModule],
  template: `
    <div
      role="group"
      [attr.aria-label]="label()"
      class="inline-flex items-center rounded-md border border-zinc-300 bg-white focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/25"
    >
      <button
        type="button"
        class="grid size-10 place-items-center rounded-l-md text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
        aria-label="Diminuir quantidade"
        [disabled]="disabled() || draft() <= 1"
        (click)="commit(draft() - 1)"
      >
        <mat-icon>remove</mat-icon>
      </button>
      <input
        type="number"
        inputmode="numeric"
        min="1"
        class="h-10 w-12 border-x border-zinc-200 bg-transparent text-center text-sm font-medium tabular-nums outline-none [appearance:textfield] disabled:text-zinc-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        [attr.aria-label]="label()"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="onType($event)"
        (change)="commit(draft())"
        (keydown.enter)="commit(draft())"
      />
      <button
        type="button"
        class="grid size-10 place-items-center rounded-r-md text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
        aria-label="Aumentar quantidade"
        [disabled]="disabled() || (max() !== undefined && draft() >= max()!)"
        (click)="commit(draft() + 1)"
      >
        <mat-icon>add</mat-icon>
      </button>
    </div>
  `,
})
export class QuantityStepper {
  readonly quantity = input.required<number>();
  /** Highest quantity the + button reaches; typing above it is still sent so the API explains why not. */
  readonly max = input<number | undefined>(undefined);
  readonly label = input('Quantidade');
  readonly disabled = input(false);
  /** A change is being saved: keep what the customer typed until it resolves. */
  readonly busy = input(false);

  readonly quantityChange = output<number>();

  protected readonly draft = linkedSignal(() => this.quantity());

  constructor() {
    effect(() => {
      const confirmed = this.quantity();
      if (!this.busy()) this.draft.set(confirmed);
    });
  }

  protected onType(event: Event): void {
    this.draft.set(Math.trunc(Number((event.target as HTMLInputElement).value)) || 0);
  }

  protected commit(value: number): void {
    const next = Math.max(1, value);
    this.draft.set(next);
    if (next !== this.quantity()) this.quantityChange.emit(next);
  }
}

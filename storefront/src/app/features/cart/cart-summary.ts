import { Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Cart } from '../../core/api/types';
import { CartStore } from './cart.store';

/** Order summary: totals, coupon and the way out to checkout. */
@Component({
  selector: 'app-cart-summary',
  imports: [FormField, RouterLink, MatButtonModule, MatIconModule],
  host: { class: 'block' },
  templateUrl: './cart-summary.html',
})
export class CartSummary {
  protected readonly store = inject(CartStore);

  readonly cart = input.required<Cart>();
  /** Checkout is closed while some line cannot be fulfilled. */
  readonly blocked = input(false);

  private readonly couponModel = signal({ code: '' });
  protected readonly couponForm = form(this.couponModel, (path) => {
    required(path.code, { message: 'Informe o código do cupom.' });
  });

  /** Message the API returned for `errors.code`. */
  protected readonly serverMessage = signal('');
  protected readonly codeMessage = computed(
    () =>
      this.serverMessage() ||
      (this.couponForm.code().touched() ? (this.couponForm.code().errors()[0]?.message ?? '') : ''),
  );

  protected applyCoupon(): void {
    void submit(this.couponForm, async () => {
      const result = await this.store.applyCoupon(this.couponModel().code.trim());
      if (result.ok) {
        this.couponModel.set({ code: '' });
        this.couponForm().reset();
        this.serverMessage.set('');
      } else {
        this.serverMessage.set(result.error.errors['code'] ?? result.error.message);
      }
    });
  }

  protected async removeCoupon(): Promise<void> {
    await this.store.removeCoupon();
  }
}

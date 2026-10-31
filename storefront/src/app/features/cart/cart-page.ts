import { Component, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CartLine } from './cart-line';
import { CartStore } from './cart.store';
import { CartSummary } from './cart-summary';

/** Client-rendered (cookie-dependent, see app.routes.server.ts). */
@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, CartLine, CartSummary],
  templateUrl: './cart-page.html',
})
export class CartPage {
  protected readonly store = inject(CartStore);

  constructor() {
    // Always revalidate on entry: stock and prices may have moved since the last visit.
    afterNextRender(() => void this.store.refresh());
  }

  protected async changeQuantity(itemId: number, quantity: number): Promise<void> {
    await this.store.updateQuantity(itemId, quantity);
  }

  protected async remove(itemId: number): Promise<void> {
    await this.store.removeItem(itemId);
  }
}

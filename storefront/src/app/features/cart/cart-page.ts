import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

/** Placeholder — PROMPT 02 replaces this with the real cart (CartStore + items + coupon). */
@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 class="text-2xl font-semibold">Seu carrinho</h1>
      <p class="mt-2 text-zinc-500">O carrinho é implementado no PROMPT 02 (PROMPTS.md).</p>
      <a mat-stroked-button routerLink="/products" class="mt-8">Continuar comprando</a>
    </div>
  `,
})
export class CartPage {}

import { Component, afterNextRender, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { categoriesResource } from '../core/api/catalog.api';
import { CartStore } from '../features/cart/cart.store';
import { HeaderSearch } from './header-search';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    HeaderSearch,
  ],
  templateUrl: './header.html',
})
export class Header {
  private readonly categoriesRes = categoriesResource();

  protected readonly cart = inject(CartStore);

  readonly categories = computed(() => this.categoriesRes.value().data);

  constructor() {
    // Browser only: the cart lives behind a cookie, so server-rendered (and edge-cached) HTML never shows it.
    afterNextRender(() => void this.cart.restore());
  }
}

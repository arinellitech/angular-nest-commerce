import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Cart, Single } from './types';

/**
 * Cart endpoints (api/docs/api.md → "Cart"). The guest token travels in the
 * `X-Cart-Token` header, attached and persisted by `apiInterceptor`.
 */
@Service()
export class CartApi {
  private readonly http = inject(HttpClient);

  create() {
    return this.http.post<Single<Cart>>('/api/v1/cart', {});
  }

  get() {
    return this.http.get<Single<Cart>>('/api/v1/cart');
  }

  addItem(productId: number, quantity: number) {
    return this.http.post<Single<Cart>>('/api/v1/cart/items', {
      product_id: productId,
      quantity,
    });
  }

  updateItem(itemId: number, quantity: number) {
    return this.http.patch<Single<Cart>>(`/api/v1/cart/items/${itemId}`, { quantity });
  }

  removeItem(itemId: number) {
    return this.http.delete<Single<Cart>>(`/api/v1/cart/items/${itemId}`);
  }

  applyCoupon(code: string) {
    return this.http.post<Single<Cart>>('/api/v1/cart/coupon', { code });
  }

  removeCoupon() {
    return this.http.delete<Single<Cart>>('/api/v1/cart/coupon');
  }
}

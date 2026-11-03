import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { toApiError, type ApiError } from '../../core/api/api-error';
import { CartApi } from '../../core/api/cart.api';
import { CartToken } from '../../core/api/cart-token';
import type { Cart, Single } from '../../core/api/types';

export type CartResult = { ok: true } | { ok: false; error: ApiError };

interface CartState {
  cart: Cart | null;
  /** `loading` only while there is nothing to show yet; later refreshes keep the cart on screen. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** A mutation is in flight; mutations run one at a time. */
  busy: boolean;
  /** Stock/validation message of the last failed change, per cart line. */
  lineErrors: Record<number, string>;
}

const initialState: CartState = { cart: null, status: 'idle', busy: false, lineErrors: {} };

/** The API forgot the cart (expired or converted): the token is useless from now on. */
const isCartGone = (error: ApiError) => error.status === 404 && error.detail === 'Cart not found.';

/**
 * Guest cart shared by the header badge, product page and cart page.
 * The cart is created lazily on the first "add to cart"; until then there is no
 * request and no token. Every method resolves to a result instead of throwing,
 * so callers map `error.errors[field]` onto their form or snackbar.
 */
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ cart }) => ({
    items: computed(() => cart()?.items ?? []),
    count: computed(() => cart()?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0),
    isEmpty: computed(() => (cart()?.items.length ?? 0) === 0),
    /** Some line asks for more than what is left, or its product is gone. */
    hasStockIssues: computed(
      () => cart()?.items.some((item) => item.quantity > item.available_quantity) ?? false,
    ),
  })),
  withMethods((store, api = inject(CartApi), token = inject(CartToken)) => {
    const forget = () => {
      token.set(null);
      patchState(store, { cart: null, status: 'ready', lineErrors: {} });
    };

    async function run(call: () => Observable<Single<Cart>>): Promise<CartResult> {
      patchState(store, { busy: true });
      try {
        const { data } = await firstValueFrom(call());
        patchState(store, { cart: data, status: 'ready' });
        return { ok: true };
      } catch (cause) {
        const error = toApiError(cause);
        if (isCartGone(error)) forget();
        else if (store.status() === 'loading') patchState(store, { status: 'error' });
        return { ok: false, error };
      } finally {
        patchState(store, { busy: false });
      }
    }

    /** Line-level changes surface their problem next to the line. */
    async function changeLine(itemId: number, call: () => Observable<Single<Cart>>) {
      patchState(store, ({ lineErrors }) => ({
        lineErrors: Object.fromEntries(
          Object.entries(lineErrors).filter(([id]) => Number(id) !== itemId),
        ),
      }));
      const result = await run(call);
      if (!result.ok && store.cart()) {
        const { errors, message } = result.error;
        patchState(store, ({ lineErrors }) => ({
          lineErrors: { ...lineErrors, [itemId]: errors['quantity'] ?? message },
        }));
      }
      return result;
    }

    async function refresh(): Promise<CartResult> {
      if (!token.value()) {
        patchState(store, { cart: null, status: 'ready' });
        return { ok: true };
      }
      if (!store.cart()) patchState(store, { status: 'loading' });
      return run(() => api.get());
    }

    async function ensureCart(): Promise<CartResult> {
      if (store.cart()) return { ok: true };
      if (token.value()) {
        const result = await refresh();
        if (store.cart()) return result;
        // Anything but "the API forgot this cart" (network, 5xx) is not ours to paper over.
        if (!result.ok && !isCartGone(result.error)) return result;
      }
      return run(() => api.create().pipe(tap(({ data }) => token.set(data.token))));
    }

    return {
      refresh,
      ensureCart,

      /** Header badge: only talks to the API when this browser already has a cart. */
      async restore(): Promise<void> {
        if (store.status() === 'idle' && token.value()) await refresh();
      },

      async addItem(productId: number, quantity: number): Promise<CartResult> {
        const ensured = await ensureCart();
        if (!ensured.ok) return ensured;

        const result = await run(() => api.addItem(productId, quantity));
        if (result.ok || !isCartGone(result.error)) return result;

        // The cart expired between visits: start a fresh one and add again.
        const fresh = await ensureCart();
        return fresh.ok ? run(() => api.addItem(productId, quantity)) : fresh;
      },

      updateQuantity(itemId: number, quantity: number): Promise<CartResult> {
        return changeLine(itemId, () => api.updateItem(itemId, quantity));
      },

      removeItem(itemId: number): Promise<CartResult> {
        return changeLine(itemId, () => api.removeItem(itemId));
      },

      applyCoupon(code: string): Promise<CartResult> {
        return run(() => api.applyCoupon(code));
      },

      removeCoupon(): Promise<CartResult> {
        return run(() => api.removeCoupon());
      },

      /** After checkout: the cart became an order, its token is useless. */
      clear(): void {
        forget();
      },
    };
  }),
);

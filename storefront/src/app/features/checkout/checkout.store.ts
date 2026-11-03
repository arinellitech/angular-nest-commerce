import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CartToken } from '../../core/api/cart-token';
import { CheckoutApi } from '../../core/api/checkout.api';
import type { CheckoutPayload, Order } from '../../core/api/types';
import { CartStore } from '../cart/cart.store';
import { PendingCheckout } from './pending-checkout';

/** Why the last attempt did not produce an order, and what the page should offer. */
export type CheckoutProblem =
  /** Validation (422) on customer/address fields: map onto the form. */
  | { kind: 'fields'; errors: Record<string, string> }
  /** Some lines can no longer be bought (stock, unpublished): back to the cart. */
  | { kind: 'items'; messages: string[] }
  /** The cart is empty, expired or already became an order. */
  | { kind: 'cart'; message: string }
  /** Nothing the customer can fix: same Idempotency-Key, try again. */
  | { kind: 'retry'; message: string };

export type PlaceOrderResult = { ok: true; order: Order } | { ok: false; problem: CheckoutProblem };

const RETRY_SAFE = 'Tente de novo: você não será cobrado duas vezes.';

/** Pure: an HTTP failure of POST /checkout → what to show. */
export function classifyCheckoutError(cause: unknown): CheckoutProblem {
  const error = toApiError(cause);
  if (error.status === 422) {
    const body = cause instanceof HttpErrorResponse ? cause.error : null;
    const items = (body as { errors?: { items?: unknown } } | null)?.errors?.items;
    if (Array.isArray(items) && items.length > 0)
      return { kind: 'items', messages: items.map(String) };
    if (error.errors['cart']) return { kind: 'cart', message: error.errors['cart'] };
    if (error.errors['idempotency_key'])
      return { kind: 'retry', message: `Não conseguimos confirmar o pedido. ${RETRY_SAFE}` };
    return { kind: 'fields', errors: error.errors };
  }
  if (error.status === 404)
    return {
      kind: 'cart',
      message: 'Seu carrinho expirou ou já virou um pedido. Confira o carrinho antes de continuar.',
    };
  if (error.status === 502)
    return {
      kind: 'retry',
      message: `O serviço de pagamento não respondeu. Seus itens continuam reservados. ${RETRY_SAFE}`,
    };
  if (error.status === 0)
    return {
      kind: 'retry',
      message: `Sem conexão com a loja. Verifique sua internet. ${RETRY_SAFE}`,
    };
  return { kind: 'retry', message: `Algo deu errado ao confirmar. ${RETRY_SAFE}` };
}

interface CheckoutState {
  placing: boolean;
  /** The order exists; the page is on its way to the payment screen. */
  done: boolean;
  /**
   * The cart already became an order in an attempt whose answer never arrived
   * (e.g. reload after a 502): the page recovers that order instead of showing the form.
   */
  recovering: boolean;
  problem: CheckoutProblem | null;
  /**
   * One per checkout attempt. Every retry resends it, so a request that
   * reached the API before the connection dropped returns the order it
   * already created instead of placing a second one.
   */
  idempotencyKey: string;
}

/** Provided by the checkout page: lives as long as one attempt. */
export const CheckoutStore = signalStore(
  withState<CheckoutState>(() => ({
    placing: false,
    done: false,
    recovering: false,
    problem: null,
    idempotencyKey: crypto.randomUUID(),
  })),
  withMethods(
    (
      store,
      api = inject(CheckoutApi),
      cart = inject(CartStore),
      cartToken = inject(CartToken),
      pending = inject(PendingCheckout),
    ) => {
      async function send(
        payload: CheckoutPayload,
        token: string | null,
      ): Promise<PlaceOrderResult> {
        if (store.placing())
          return {
            ok: false,
            problem: { kind: 'retry', message: 'Já estamos confirmando seu pedido…' },
          };
        patchState(store, { placing: true, problem: null });
        if (token)
          pending.save({ cartToken: token, idempotencyKey: store.idempotencyKey(), payload });
        try {
          const { data } = await firstValueFrom(
            api.place(payload, store.idempotencyKey(), token ?? undefined),
          );
          pending.clear();
          // The cart is now an order: drop it (and its token) so the next purchase starts clean.
          patchState(store, { done: true });
          cart.clear();
          return { ok: true, order: data };
        } catch (cause) {
          const problem = classifyCheckoutError(cause);
          // Only an unanswered attempt may have created an order worth recovering.
          if (problem.kind !== 'retry') pending.clear();
          const keyTaken = toApiError(cause).errors['idempotency_key'] !== undefined;
          patchState(store, {
            problem,
            ...(keyTaken ? { idempotencyKey: crypto.randomUUID() } : {}),
          });
          // Stock or cart changed under us: show the cart as the API sees it now.
          if ((problem.kind === 'items' || problem.kind === 'cart') && !store.recovering())
            void cart.refresh();
          return { ok: false, problem };
        } finally {
          patchState(store, { placing: false });
        }
      }

      return {
        place(payload: CheckoutPayload): Promise<PlaceOrderResult> {
          return send(payload, cartToken.value());
        },

        /**
         * Call after the cart was (re)loaded. If the last attempt in this tab
         * never got an answer and its cart is gone (converted into an order),
         * resend it with the same key and cart token to get that order back.
         * On a converted cart the API can only replay, never create another
         * order. Resolves to null when there is nothing to recover.
         */
        async resume(): Promise<PlaceOrderResult | null> {
          const attempt = pending.read();
          if (!attempt || cart.status() === 'error') return null;
          if (cartToken.value() !== null) {
            // The cart is still alive, so that attempt created nothing.
            pending.clear();
            return null;
          }
          patchState(store, { recovering: true, idempotencyKey: attempt.idempotencyKey });
          const result = await send(attempt.payload, attempt.cartToken);
          if (!result.ok && result.problem.kind !== 'retry')
            patchState(store, { recovering: false });
          return result;
        },

        dismissProblem(): void {
          patchState(store, { problem: null });
        },
      };
    },
  ),
);

import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import type { CheckoutPayload } from '../../core/api/types';

/** A checkout request whose outcome the browser never learned (timeout, 502, reload). */
export interface PendingAttempt {
  cartToken: string;
  idempotencyKey: string;
  payload: CheckoutPayload;
}

const KEY = 'checkout:pending';

/**
 * Remembers the last unresolved checkout attempt in sessionStorage (this tab
 * only), so a reload after "the payment service did not answer" can resend the
 * same Idempotency-Key and recover the order the API may already have created.
 * Holds the customer's data only until the attempt resolves either way.
 */
@Service()
export class PendingCheckout {
  private readonly storage = this.resolveStorage();

  read(): PendingAttempt | null {
    try {
      const raw = this.storage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as PendingAttempt) : null;
    } catch {
      return null;
    }
  }

  save(attempt: PendingAttempt): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(attempt));
    } catch {
      // Storage full or blocked: the attempt simply is not recoverable after a reload.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  }

  private resolveStorage(): Storage | null {
    try {
      return inject(DOCUMENT).defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  }
}

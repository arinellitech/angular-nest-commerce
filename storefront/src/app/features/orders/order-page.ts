import { Location, NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { orderResource } from '../../core/api/checkout.api';
import type { OrderStatus } from '../../core/api/types';
import { PixPayment } from './pix-payment';

/** Label + pill colors per status (contrast ≥ 4.5:1 on the tinted background). */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  pending_payment: {
    label: 'Aguardando pagamento',
    tone: 'bg-amber-100 text-amber-900 ring-amber-200',
  },
  paid: { label: 'Pagamento confirmado', tone: 'bg-emerald-100 text-emerald-900 ring-emerald-200' },
  fulfilled: { label: 'Enviado', tone: 'bg-emerald-100 text-emerald-900 ring-emerald-200' },
  cancelled: { label: 'Cancelado', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  refunded: { label: 'Reembolsado', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
};

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** State handed over by the checkout page on success. */
interface PlacedState {
  placed?: boolean;
  totalChanged?: boolean;
}

/**
 * /orders/:number?token=… — client-rendered (personal data, never cached).
 * Readable with the signed `token` from the URL (checkout redirect, e-mail
 * link) or, without it, with the cart token of the browser that bought.
 */
@Component({
  selector: 'app-order-page',
  imports: [NgOptimizedImage, RouterLink, MatButtonModule, MatIconModule, PixPayment],
  templateUrl: './order-page.html',
})
export class OrderPage {
  /** Route param. */
  readonly number = input<string>();
  /** Query param: signed access token. */
  readonly token = input<string>();

  protected readonly resource = orderResource(this.number, this.token);
  protected readonly order = computed(() =>
    this.resource.hasValue() ? this.resource.value().data : undefined,
  );
  protected readonly notFound = computed(() => {
    const error = this.resource.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });
  /** The Pix charge to pay, while the order waits for it. */
  protected readonly pixPayment = computed(() => {
    const payment = this.order()?.payment;
    return payment?.method === 'pix' && payment.pix_copy_paste ? payment : null;
  });
  protected readonly status = computed(() => {
    const order = this.order();
    return order ? ORDER_STATUS[order.status] : undefined;
  });
  protected readonly placedAt = computed(() => {
    const at = this.order()?.placed_at;
    return at ? dateTime.format(new Date(at)) : '';
  });

  /** Arrived straight from checkout (not from a link or a reload). */
  protected readonly arrival = (inject(Location).getState() ?? {}) as PlacedState;

  constructor() {
    const title = inject(Title);
    effect(() => {
      const order = this.order();
      if (order) title.setTitle(`Pedido ${order.number} · Loja Demo`);
    });
  }
}

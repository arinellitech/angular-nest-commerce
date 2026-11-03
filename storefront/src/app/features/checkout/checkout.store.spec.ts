import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartToken } from '../../core/api/cart-token';
import type { CheckoutPayload, Money, Order } from '../../core/api/types';
import { CartStore } from '../cart/cart.store';
import { CheckoutStore } from './checkout.store';
import { PendingCheckout } from './pending-checkout';

const money = (amount: number): Money => ({ amount, currency: 'BRL', formatted: `R$ ${amount}` });

const payload: CheckoutPayload = {
  customer: {
    name: 'Ana',
    email: 'ana@example.com',
    document: '52998224725',
    phone: '11987654321',
  },
  shipping_address: {
    line1: 'Av. Paulista, 1000',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01310100',
    country: 'BR',
  },
  payment_method: 'pix',
};

const order = {
  id: 'o-1',
  number: 'ORD-2026-000001',
  status: 'pending_payment',
  total: money(9190),
  access_token: 'signed',
} as Order;

describe('CheckoutStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof CheckoutStore>;
  let token: CartToken;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CheckoutStore],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CheckoutStore);
    token = TestBed.inject(CartToken);
    token.set('cart-token');
  });

  afterEach(() => {
    http.verify();
    token.set(null);
    sessionStorage.clear();
  });

  const expectCheckout = () => {
    const req = http.expectOne('/api/v1/checkout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    return req;
  };

  it('places the order with a UUID Idempotency-Key and forgets the cart', async () => {
    const pending = store.place(payload);
    const req = expectCheckout();
    const key = req.request.headers.get('Idempotency-Key');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({ data: order }, { status: 201, statusText: 'Created' });

    await expect(pending).resolves.toEqual({ ok: true, order });
    expect(store.done()).toBe(true);
    expect(token.value()).toBeNull();
    expect(TestBed.inject(CartStore).cart()).toBeNull();
  });

  it('resends the same key after a provider failure or a dropped connection', async () => {
    let pending = store.place(payload);
    let req = expectCheckout();
    const key = req.request.headers.get('Idempotency-Key');
    req.flush(
      { message: 'Payment provider unavailable. Retry with the same Idempotency-Key.' },
      { status: 502, statusText: 'Bad Gateway' },
    );
    const failed = await pending;
    expect(failed).toMatchObject({ ok: false, problem: { kind: 'retry' } });
    expect(store.problem()?.kind).toBe('retry');
    expect(token.value()).toBe('cart-token');

    pending = store.place(payload);
    req = expectCheckout();
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    req.error(new ProgressEvent('error'), { status: 0, statusText: '' });
    await pending;

    pending = store.place(payload);
    req = expectCheckout();
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    req.flush({ data: order }, { status: 200, statusText: 'OK' });
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(store.problem()).toBeNull();
  });

  it('lists every unavailable line and reloads the cart', async () => {
    const pending = store.place(payload);
    expectCheckout().flush(
      {
        message: 'Some items are no longer available.',
        errors: {
          items: ['Cadeira: apenas 1 unidade disponível.', 'Luminária não está mais disponível.'],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await expect(pending).resolves.toEqual({
      ok: false,
      problem: {
        kind: 'items',
        messages: ['Cadeira: apenas 1 unidade disponível.', 'Luminária não está mais disponível.'],
      },
    });
    http
      .expectOne('/api/v1/cart')
      .flush({ message: 'Cart not found.' }, { status: 404, statusText: '' });
  });

  it('hands field errors back to the form', async () => {
    const pending = store.place(payload);
    expectCheckout().flush(
      { message: 'Validation failed.', errors: { 'customer.document': ['CPF inválido.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(pending).resolves.toEqual({
      ok: false,
      problem: { kind: 'fields', errors: { 'customer.document': 'CPF inválido.' } },
    });
  });

  it('draws a new key when the API says this one belongs to another cart', async () => {
    let pending = store.place(payload);
    let req = expectCheckout();
    const key = req.request.headers.get('Idempotency-Key');
    req.flush(
      { message: 'Idempotency-Key already used.', errors: { idempotency_key: ['…'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await pending;

    pending = store.place(payload);
    req = expectCheckout();
    expect(req.request.headers.get('Idempotency-Key')).not.toBe(key);
    req.flush({ data: order });
    await pending;
  });

  describe('recovering an unanswered attempt', () => {
    it('keeps the attempt while unanswered and forgets it once it resolves', async () => {
      const saved = TestBed.inject(PendingCheckout);
      const pending = store.place(payload);
      const req = expectCheckout();
      expect(saved.read()).toEqual({
        cartToken: 'cart-token',
        idempotencyKey: req.request.headers.get('Idempotency-Key'),
        payload,
      });
      req.flush({ message: 'down' }, { status: 502, statusText: 'Bad Gateway' });
      await pending;
      expect(saved.read()).not.toBeNull();

      const again = store.place(payload);
      expectCheckout().flush({ data: order });
      await again;
      expect(saved.read()).toBeNull();
    });

    it('replays it with the same key and cart token after a reload lost the cart', async () => {
      const key = '0b6f0e1e-6c2a-4c55-9b7e-2f1d8a4b9c10';
      TestBed.inject(PendingCheckout).save({ cartToken: 'old-cart', idempotencyKey: key, payload });
      token.set(null); // the reload found the cart converted and dropped its token

      const resumed = store.resume();
      const req = expectCheckout();
      expect(store.recovering()).toBe(true);
      expect(req.request.headers.get('Idempotency-Key')).toBe(key);
      expect(req.request.headers.get('X-Cart-Token')).toBe('old-cart');
      req.flush({ data: order }, { status: 200, statusText: 'OK' });

      await expect(resumed).resolves.toEqual({ ok: true, order });
      expect(TestBed.inject(PendingCheckout).read()).toBeNull();
    });

    it('drops it without a request while the cart is still alive', async () => {
      TestBed.inject(PendingCheckout).save({
        cartToken: 'cart-token',
        idempotencyKey: '0b6f0e1e-6c2a-4c55-9b7e-2f1d8a4b9c10',
        payload,
      });
      await expect(store.resume()).resolves.toBeNull();
      expect(TestBed.inject(PendingCheckout).read()).toBeNull();
      expect(store.recovering()).toBe(false);
    });
  });
});

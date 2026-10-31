import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartToken } from '../../core/api/cart-token';
import type { Cart, CartItem, Money } from '../../core/api/types';
import { CartStore } from './cart.store';

const money = (amount: number): Money => ({
  amount,
  currency: 'BRL',
  formatted: `R$ ${(amount / 100).toFixed(2).replace('.', ',')}`,
});

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    product: { id: 10, name: 'Teclado', slug: 'teclado', images: [] },
    quantity: 2,
    unit_price: money(4000),
    total: money(8000),
    available_quantity: 10,
    ...overrides,
  };
}

function cart(items: CartItem[] = []): Cart {
  return {
    id: 'cart-1',
    token: 'tok-1',
    currency: 'BRL',
    status: 'active',
    items,
    coupon: null,
    subtotal: money(0),
    discount: money(0),
    shipping: money(0),
    total: money(0),
    expires_at: null,
  };
}

describe('CartStore', () => {
  let http: HttpTestingController;
  let token: CartToken;

  const api = (path: string) => `/api/v1/cart${path}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    token = TestBed.inject(CartToken);
    token.set(null);
  });

  afterEach(() => {
    http.verify();
    token.set(null);
  });

  it('does not call the API on startup when the browser has no cart yet', async () => {
    const store = TestBed.inject(CartStore);
    await store.restore();
    expect(store.cart()).toBeNull();
    expect(store.count()).toBe(0);
    expect(store.isEmpty()).toBe(true);
  });

  it('restores the cart behind an existing token', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);

    const restoring = store.restore();
    http
      .expectOne(api(''))
      .flush({ data: cart([item({ quantity: 2 }), item({ id: 2, quantity: 1 })]) });
    await restoring;

    expect(store.status()).toBe('ready');
    expect(store.count()).toBe(3);
  });

  it('creates the cart lazily on the first add, then adds the item', async () => {
    const store = TestBed.inject(CartStore);

    const adding = store.addItem(10, 2);
    http.expectOne({ method: 'POST', url: api('') }).flush({ data: cart() });
    await vi.waitFor(() =>
      http
        .expectOne({ method: 'POST', url: api('/items') })
        .flush({ data: cart([item({ quantity: 2 })]) }),
    );

    expect(await adding).toEqual({ ok: true });
    expect(token.value()).toBe('tok-1');
    expect(store.count()).toBe(2);
  });

  it('sends product_id and quantity and keeps the returned cart', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const restoring = store.restore();
    http.expectOne(api('')).flush({ data: cart() });
    await restoring;

    const adding = store.addItem(10, 3);
    const req = await vi.waitFor(() => http.expectOne({ method: 'POST', url: api('/items') }));
    expect(req.request.body).toEqual({ product_id: 10, quantity: 3 });
    req.flush({ data: cart([item({ quantity: 3 })]) }, { status: 201, statusText: 'Created' });

    expect(await adding).toEqual({ ok: true });
    expect(store.count()).toBe(3);
    expect(store.busy()).toBe(false);
  });

  it('puts a stock error (422) next to the line and keeps the cart untouched', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const restoring = store.restore();
    http.expectOne(api('')).flush({ data: cart([item({ id: 7, quantity: 2 })]) });
    await restoring;

    const updating = store.updateQuantity(7, 50);
    http.expectOne({ method: 'PATCH', url: api('/items/7') }).flush(
      {
        message: 'Insufficient stock.',
        errors: { quantity: ['Apenas 10 unidades disponíveis.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    const result = await updating;

    expect(result.ok).toBe(false);
    expect(store.lineErrors()).toEqual({ 7: 'Apenas 10 unidades disponíveis.' });
    expect(store.items()[0].quantity).toBe(2);
  });

  it('clears the line error on the next successful change', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const restoring = store.restore();
    http.expectOne(api('')).flush({ data: cart([item({ id: 7 })]) });
    await restoring;

    const failed = store.updateQuantity(7, 50);
    http
      .expectOne(api('/items/7'))
      .flush(
        { message: 'x', errors: { quantity: ['Sem estoque.'] } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await failed;

    const ok = store.updateQuantity(7, 3);
    http.expectOne(api('/items/7')).flush({ data: cart([item({ id: 7, quantity: 3 })]) });
    await ok;
    expect(store.lineErrors()).toEqual({});
  });

  it('flags stock issues when a line asks for more than what is left', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const restoring = store.restore();
    http.expectOne(api('')).flush({
      data: cart([item({ quantity: 3, available_quantity: 1 })]),
    });
    await restoring;
    expect(store.hasStockIssues()).toBe(true);
  });

  it('forgets an expired cart and starts a fresh one when adding', async () => {
    token.set('old-token');
    const store = TestBed.inject(CartStore);

    const adding = store.addItem(10, 1);
    // ensureCart revalidates the stored token first: the API has forgotten it.
    http
      .expectOne({ method: 'GET', url: api('') })
      .flush({ message: 'Cart not found.' }, { status: 404, statusText: 'Not Found' });
    await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: api('') }).flush({ data: cart() }),
    );
    await vi.waitFor(() =>
      http
        .expectOne({ method: 'POST', url: api('/items') })
        .flush({ data: cart([item({ quantity: 1 })]) }),
    );

    expect(await adding).toEqual({ ok: true });
    expect(token.value()).toBe('tok-1');
    expect(store.count()).toBe(1);
  });

  it('maps a coupon rejection onto errors.code', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const restoring = store.restore();
    http.expectOne(api('')).flush({ data: cart([item()]) });
    await restoring;

    const applying = store.applyCoupon('NOPE');
    http
      .expectOne({ method: 'POST', url: api('/coupon') })
      .flush(
        { message: 'Coupon not applicable.', errors: { code: ['Cupom inválido.'] } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    const result = await applying;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.errors['code']).toBe('Cupom inválido.');
  });

  it('shows a load error only when there is nothing to show yet', async () => {
    token.set('tok-1');
    const store = TestBed.inject(CartStore);
    const loading = store.refresh();
    http.expectOne(api('')).error(new ProgressEvent('error'));
    await loading;
    expect(store.status()).toBe('error');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartToken } from '../../core/api/cart-token';
import type { Cart, Money } from '../../core/api/types';
import { CartSummary } from './cart-summary';

const money = (amount: number): Money => ({
  amount,
  currency: 'BRL',
  formatted: `R$ ${(amount / 100).toFixed(2).replace('.', ',')}`,
});

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 'cart-1',
    token: 'tok-1',
    currency: 'BRL',
    status: 'active',
    items: [],
    coupon: null,
    subtotal: money(10000),
    discount: money(0),
    shipping: money(1990),
    total: money(11990),
    expires_at: null,
    ...overrides,
  };
}

describe('CartSummary', () => {
  let http: HttpTestingController;

  function create(value: Cart, blocked = false) {
    const fixture = TestBed.createComponent(CartSummary);
    fixture.componentRef.setInput('cart', value);
    fixture.componentRef.setInput('blocked', blocked);
    fixture.detectChanges();
    return fixture;
  }

  const text = (root: HTMLElement, id: string) =>
    root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CartToken).set('tok-1');
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(CartToken).set(null);
  });

  it('shows subtotal, shipping and total from the API', () => {
    const root: HTMLElement = create(cart()).nativeElement;
    expect(text(root, 'subtotal')).toBe('R$ 100,00');
    expect(text(root, 'shipping')).toBe('R$ 19,90');
    expect(text(root, 'total')).toBe('R$ 119,90');
    expect(root.querySelector('[data-testid="discount"]')).toBeNull();
  });

  it('shows free shipping and the applied coupon discount', () => {
    const root: HTMLElement = create(
      cart({
        coupon: { code: 'BEMVINDO10', discount: money(1000) },
        discount: money(1000),
        shipping: money(0),
        total: money(9000),
      }),
    ).nativeElement;
    expect(text(root, 'shipping')).toBe('Grátis');
    expect(text(root, 'discount')).toContain('R$ 10,00');
    expect(root.textContent).toContain('BEMVINDO10');
    expect(root.querySelector('#coupon-code')).toBeNull();
  });

  it('asks for the code before calling the API', async () => {
    const fixture = create(cart());
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectNone('/api/v1/cart/coupon');
    expect(root.querySelector('#coupon-error')?.textContent).toContain('Informe o código');
  });

  it('shows the API reason under the field when the coupon is rejected', async () => {
    const fixture = create(cart());
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('#coupon-code')!;
    input.value = 'EXPIRADO';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));

    const req = await vi.waitFor(() => http.expectOne('/api/v1/cart/coupon'));
    expect(req.request.body).toEqual({ code: 'EXPIRADO' });
    req.flush(
      { message: 'Coupon not applicable.', errors: { code: ['Este cupom expirou.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('#coupon-error')?.textContent).toContain('Este cupom expirou.');
    expect(root.querySelector('#coupon-code')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks checkout while a line cannot be fulfilled', () => {
    const root: HTMLElement = create(cart(), true).nativeElement;
    const checkout = root.querySelector('a[href="/checkout"]');
    expect(checkout?.getAttribute('aria-disabled')).toBe('true');
    expect(root.textContent).toContain('Resolva os itens sem estoque');
  });
});

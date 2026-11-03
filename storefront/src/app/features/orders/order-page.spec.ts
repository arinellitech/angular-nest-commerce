import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Money, Order } from '../../core/api/types';
import { OrderPage } from './order-page';

const money = (amount: number, formatted: string): Money => ({
  amount,
  currency: 'BRL',
  formatted,
});

const order: Order = {
  id: 'o-1',
  number: 'ORD-2026-000042',
  status: 'pending_payment',
  currency: 'BRL',
  customer: {
    name: 'Ana Souza',
    email: 'ana@example.com',
    document: '***.982.247-**',
    phone: '11987654321',
  },
  shipping_address: {
    line1: 'Av. Paulista, 1000',
    line2: 'Apto 12',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01310100',
    country: 'BR',
  },
  items: [
    {
      id: 1,
      product_id: 3,
      slug: 'teclado',
      image: null,
      name: 'Teclado Mecânico',
      sku: 'SKU-3',
      quantity: 2,
      unit_price: money(4000, 'R$ 40,00'),
      total: money(8000, 'R$ 80,00'),
    },
  ],
  coupon: { code: 'BEMVINDO10' },
  subtotal: money(8000, 'R$ 80,00'),
  discount: money(800, 'R$ 8,00'),
  shipping: money(1990, 'R$ 19,90'),
  total: money(9190, 'R$ 91,90'),
  payment: {
    id: 'p-1',
    provider: 'mock',
    method: 'pix',
    status: 'pending',
    amount: money(9190, 'R$ 91,90'),
    pix_copy_paste: '00020126580014br.gov.bcb.pix0136abc',
    pix_qr_code: null,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    confirmed_at: null,
  },
  access_token: 'signed-token',
  placed_at: '2026-10-31T15:00:00.000Z',
  paid_at: null,
  cancelled_at: null,
};

describe('OrderPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Creates the page and lets the resource send its request (not awaited: it is pending). */
  function render(number: string, token?: string) {
    const fixture = TestBed.createComponent(OrderPage);
    fixture.componentRef.setInput('number', number);
    if (token) fixture.componentRef.setInput('token', token);
    TestBed.tick();
    return fixture;
  }

  it('loads the order with the signed token and shows status, Pix and totals', async () => {
    const fixture = render('ORD-2026-000042', 'signed-token');
    const req = http.expectOne(
      (r) => r.url === '/api/v1/orders/ORD-2026-000042' && r.params.get('token') === 'signed-token',
    );
    req.flush({ data: order });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')!.textContent).toContain('ORD-2026-000042');
    expect(el.textContent).toContain('Aguardando pagamento');
    expect(el.querySelector('app-pix-payment')).not.toBeNull();
    expect(el.textContent).toContain('Teclado Mecânico');
    expect(el.textContent).toContain('Desconto (BEMVINDO10)');
    expect(el.textContent).toContain('R$ 91,90');
    expect(el.textContent).toContain('CPF ***.982.247-**');
  });

  it('explains a missing order instead of failing', async () => {
    const fixture = render('ORD-2026-999999');
    http
      .expectOne('/api/v1/orders/ORD-2026-999999')
      .flush({ message: 'Order not found.' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Pedido não encontrado');
    expect(el.querySelector('app-pix-payment')).toBeNull();
  });

  it('shows the confirmation instead of the Pix once paid', async () => {
    const fixture = render('ORD-2026-000042', 'signed-token');
    http
      .expectOne((r) => r.url === '/api/v1/orders/ORD-2026-000042')
      .flush({ data: { ...order, status: 'paid', paid_at: '2026-10-31T15:05:00.000Z' } });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Pagamento confirmado');
    expect(el.querySelector('app-pix-payment')).toBeNull();
  });
});

import { toMoney } from '../common/money.js';
import { renderOrderPlacedEmail } from './order-email.js';
import type { OrderResource } from './orders.mappers.js';

const order: OrderResource = {
  id: '0b6f0e1e-6c2a-4c55-9b7e-2f1d8a4b9c10',
  number: 'ORD-2026-000007',
  status: 'pending_payment',
  currency: 'BRL',
  customer: {
    name: 'Ana <b>Souza</b>',
    email: 'ana@example.com',
    document: '***.982.247-**',
    phone: '11987654321',
  },
  shipping_address: {
    line1: 'Av. Paulista, 1000',
    line2: null,
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
      name: 'Teclado <Mecânico>',
      sku: 'SKU-3',
      quantity: 2,
      unit_price: toMoney(4000),
      total: toMoney(8000),
    },
  ],
  coupon: { code: 'BEMVINDO10' },
  subtotal: toMoney(8000),
  discount: toMoney(800),
  shipping: toMoney(1990),
  total: toMoney(9190),
  payment: {
    id: 'p1',
    provider: 'mock',
    method: 'pix',
    status: 'pending',
    amount: toMoney(9190),
    pix_copy_paste: '000201PIXCODE',
    pix_qr_code: null,
    expires_at: '2026-10-31T15:30:00.000Z',
    confirmed_at: null,
  },
  access_token: 'tok',
  placed_at: '2026-10-31T15:00:00.000Z',
  paid_at: null,
  cancelled_at: null,
};

const url = 'http://localhost:4200/orders/ORD-2026-000007?token=tok';

describe('renderOrderPlacedEmail', () => {
  it('summarizes the order with Pix code, expiry in Brasília time and the link', () => {
    const mail = renderOrderPlacedEmail(order, url);
    expect(mail.subject).toBe('Pedido ORD-2026-000007 recebido');
    expect(mail.text).toContain('Olá, Ana!');
    expect(mail.text).toContain('2 × Teclado <Mecânico>');
    expect(mail.text).toContain('Desconto (BEMVINDO10)');
    expect(mail.text).toContain('000201PIXCODE');
    expect(mail.text).toContain('31/10/2026, 12:30');
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
  });

  it('escapes customer-controlled text in the HTML part', () => {
    const { html } = renderOrderPlacedEmail(order, url);
    expect(html).toContain('Teclado &lt;Mecânico&gt;');
    expect(html).not.toContain('<Mecânico>');
  });

  it('omits the Pix block while there is no charge yet and shows free shipping', () => {
    const mail = renderOrderPlacedEmail(
      { ...order, payment: null, shipping: toMoney(0), discount: toMoney(0) },
      url,
    );
    expect(mail.text).not.toContain('Pix');
    expect(mail.text).not.toContain('Desconto');
    expect(mail.text).toContain('Frete: Grátis');
  });
});

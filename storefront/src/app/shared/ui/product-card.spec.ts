import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import type { Product } from '../../core/api/types';
import { ProductCard } from './product-card';

const product: Product = {
  id: 1,
  name: 'Fone X',
  slug: 'fone-x',
  sku: 'FNX-1',
  description: null,
  price: { amount: 19990, currency: 'BRL', formatted: 'R$ 199,90' },
  compare_at_price: { amount: 24990, currency: 'BRL', formatted: 'R$ 249,90' },
  specs: {},
  in_stock: false,
  available_quantity: 0,
  images: [],
  published_at: '2026-10-01T00:00:00Z',
};

describe('ProductCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders name, price, discount and out-of-stock badge', async () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', product);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Fone X');
    expect(text).toContain('R$ 199,90');
    expect(text).toContain('-20%');
    expect(text).toContain('Esgotado');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe(
      '/products/fone-x',
    );
  });
});

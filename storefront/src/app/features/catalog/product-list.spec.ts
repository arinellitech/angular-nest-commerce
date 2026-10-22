import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ProductPage } from '../../core/api/types';
import { ProductList } from './product-list';

const money = (amount: number, formatted: string) => ({ amount, currency: 'BRL', formatted });

const page = (overrides: Partial<ProductPage['meta']> = {}): ProductPage => ({
  data: [],
  links: { first: null, last: null, prev: null, next: null },
  meta: {
    current_page: 1,
    from: null,
    last_page: 1,
    per_page: 24,
    to: null,
    total: 0,
    ...overrides,
  },
});

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const flush = async (body: ProductPage) => {
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/v1/categories').flush({ data: [] });
    http.expectOne((r) => r.url === '/api/v1/products').flush(body);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProductList);
  });

  afterEach(() => http.verify());

  it('writes filters to the URL: resets the page, 1 for booleans, prices in cents', async () => {
    await flush(page());
    const list = fixture.componentInstance;

    list.update({ in_stock: true, min_price: 10000, max_price: undefined });
    expect(navigate).toHaveBeenLastCalledWith(['/products'], {
      queryParams: { page: undefined, in_stock: '1', min_price: 10000, max_price: undefined },
      queryParamsHandling: 'merge',
    });

    list.clearAll();
    expect(navigate).toHaveBeenLastCalledWith(['/products'], {
      queryParams: {
        page: undefined,
        search: undefined,
        category: undefined,
        min_price: undefined,
        max_price: undefined,
        in_stock: undefined,
      },
      queryParamsHandling: 'merge',
    });
  });

  it('reads the URL defensively and mirrors the API default sort', async () => {
    fixture.componentRef.setInput('search', ' teclado ');
    fixture.componentRef.setInput('min_price', 'abc');
    fixture.componentRef.setInput('max_price', '50000');
    await flush(page());
    const list = fixture.componentInstance;

    expect(list.filters()).toMatchObject({
      search: 'teclado',
      min_price: undefined,
      max_price: 50000,
    });
    expect(list.effectiveSort()).toBe('relevance');
    expect(list.sortOptions().map((o) => o.value)).toContain('relevance');

    fixture.componentRef.setInput('search', undefined);
    fixture.componentRef.setInput('sort', 'relevance');
    TestBed.tick();
    expect(list.effectiveSort()).toBe('newest');
    expect(list.sortOptions().map((o) => o.value)).not.toContain('relevance');
    http.match(() => true).forEach((r) => r.flush(page()));
  });

  it('shows the facets of a search in the filter panel', async () => {
    fixture.componentRef.setInput('search', 'mecanico');
    await flush(
      page({
        total: 2,
        facets: {
          categories: [{ slug: 'teclados', name: 'Teclados', count: 2 }],
          price: { min: money(27990, 'R$ 279,90'), max: money(34990, 'R$ 349,90') },
        },
      }),
    );

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Resultados para “mecanico”');
    expect(text).toContain('Teclados');
    expect(text).toContain('Nesta busca: R$ 279,90 a R$ 349,90');
    expect(text).toContain('Nenhum produto encontrado');
  });
});

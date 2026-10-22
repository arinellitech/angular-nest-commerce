import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HeaderSearch } from './header-search';

describe('HeaderSearch', () => {
  let http: HttpTestingController;

  const productRequests = () => http.match((r) => r.url === '/api/v1/products');

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [HeaderSearch],
      providers: [
        provideRouter([{ path: 'products', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('asks for 5 suggestions only after typing pauses for 300ms', async () => {
    const fixture = TestBed.createComponent(HeaderSearch);
    TestBed.tick();

    const header = fixture.componentInstance;
    header.onInput('te');
    await vi.advanceTimersByTimeAsync(150);
    header.onInput('tecl');
    await vi.advanceTimersByTimeAsync(150);
    header.onInput('teclado');
    await vi.advanceTimersByTimeAsync(299);
    TestBed.tick();
    expect(productRequests()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    TestBed.tick();
    const [request, ...others] = productRequests();
    expect(others).toEqual([]);
    expect(request!.request.params.get('search')).toBe('teclado');
    expect(request!.request.params.get('per_page')).toBe('5');
    request!.flush({
      data: [],
      links: { first: null, last: null, prev: null, next: null },
      meta: { current_page: 1, from: null, last_page: 1, per_page: 5, to: null, total: 0 },
    });
  });

  it('starts from the search in the URL without fetching suggestions', async () => {
    await TestBed.inject(Router).navigateByUrl('/products?search=teclado');
    const fixture = TestBed.createComponent(HeaderSearch);
    await vi.advanceTimersByTimeAsync(400);
    TestBed.tick();

    expect(fixture.componentInstance.term()).toBe('teclado');
    expect(productRequests()).toEqual([]);
  });

  it('does not search for a single character', async () => {
    const fixture = TestBed.createComponent(HeaderSearch);
    TestBed.tick();

    fixture.componentInstance.onInput('t');
    await vi.advanceTimersByTimeAsync(400);
    TestBed.tick();
    expect(productRequests()).toEqual([]);
  });
});

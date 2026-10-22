import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogFilters, type FilterPatch } from './catalog-filters';

describe('CatalogFilters', () => {
  let fixture: ComponentFixture<CatalogFilters>;
  let emitted: FilterPatch[];
  const el = () => fixture.nativeElement as HTMLElement;

  const type = (label: string, value: string) => {
    const input = [...el().querySelectorAll('label')]
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  };

  const submit = async () => {
    el()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogFilters],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogFilters);
    fixture.componentRef.setInput('categories', [
      { slug: 'teclados', name: 'Teclados', count: 8, depth: 0 },
    ]);
    fixture.componentRef.setInput('selected', 'teclados');
    emitted = [];
    fixture.componentInstance.changed.subscribe((patch) => emitted.push(patch));
    await fixture.whenStable();
  });

  it('marks the selected category and links each option to its URL', () => {
    const current = el().querySelector('a[aria-current="true"]')!;
    expect(current.textContent).toContain('Teclados');
    expect(current.textContent).toContain('8');
    expect(current.getAttribute('href')).toBe('/products?category=teclados');
  });

  it('emits the price range in cents', async () => {
    type('Mínimo', '100');
    type('Máximo', '500');
    await submit();
    expect(emitted).toEqual([{ min_price: 10000, max_price: 50000 }]);
  });

  it('blocks an inverted range with an inline error', async () => {
    type('Mínimo', '500');
    type('Máximo', '100');
    await submit();
    expect(emitted).toEqual([]);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(
      'O máximo precisa ser maior que o mínimo.',
    );
  });

  it('shows the price range of the current search as a hint', async () => {
    fixture.componentRef.setInput('priceBounds', {
      min: { amount: 8764, currency: 'BRL', formatted: 'R$ 87,64' },
      max: { amount: 86789, currency: 'BRL', formatted: 'R$ 867,89' },
    });
    await fixture.whenStable();
    expect(el().textContent).toContain('Nesta busca: R$ 87,64 a R$ 867,89');
  });
});

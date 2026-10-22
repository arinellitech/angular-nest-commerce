import type { Category, ProductFacets } from '../../core/api/types';
import {
  categoryOptions,
  centsToReais,
  filterChips,
  parseCents,
  priceLabel,
  reaisToCents,
} from './catalog-filters.model';

const category = (slug: string, name: string, extra: Partial<Category> = {}): Category => ({
  id: slug.length,
  slug,
  name,
  description: null,
  position: 0,
  ...extra,
});

const tree: Category[] = [
  category('eletronicos', 'Eletrônicos', {
    products_count: 21,
    children: [
      category('teclados', 'Teclados', { products_count: 8 }),
      category('monitores', 'Monitores', { products_count: 6 }),
    ],
  }),
];

const money = (amount: number) => ({ amount, currency: 'BRL', formatted: `R$ ${amount / 100}` });

describe('price conversions', () => {
  it('parses only well-formed cents from the URL', () => {
    expect(parseCents('19990')).toBe(19990);
    expect(parseCents(undefined)).toBeUndefined();
    expect(parseCents('-5')).toBeUndefined();
    expect(parseCents('12.5')).toBeUndefined();
  });

  it('converts whole reais typed by the shopper to cents and back', () => {
    expect(reaisToCents(' 150 ')).toBe(15000);
    expect(reaisToCents('')).toBeUndefined();
    expect(reaisToCents('99,90')).toBeUndefined();
    expect(centsToReais(15099)).toBe('150');
    expect(centsToReais(undefined)).toBe('');
  });
});

describe('categoryOptions', () => {
  it('lists the whole tree with counts when there are no facets', () => {
    expect(categoryOptions(tree, undefined, undefined)).toEqual([
      { slug: 'eletronicos', name: 'Eletrônicos', count: 21, depth: 0 },
      { slug: 'teclados', name: 'Teclados', count: 8, depth: 1 },
      { slug: 'monitores', name: 'Monitores', count: 6, depth: 1 },
    ]);
  });

  it('follows the facets when searching and keeps the selected category visible', () => {
    const facets: ProductFacets = {
      categories: [{ slug: 'teclados', name: 'Teclados', count: 2 }],
      price: { min: money(27990), max: money(34990) },
    };
    expect(categoryOptions(tree, facets, 'eletronicos')).toEqual([
      { slug: 'eletronicos', name: 'Eletrônicos', depth: 0 },
      { slug: 'teclados', name: 'Teclados', count: 2, depth: 0 },
    ]);
    expect(categoryOptions(tree, facets, 'teclados')).toHaveLength(1);
  });
});

describe('filter chips', () => {
  it('describes each active filter and what removing it clears', () => {
    expect(
      filterChips(
        { search: 'teclado', category: 'teclados', min_price: 10000, in_stock: true },
        'Teclados',
      ),
    ).toEqual([
      { label: '“teclado”', patch: { search: undefined } },
      { label: 'Teclados', patch: { category: undefined } },
      {
        label: expect.stringContaining('A partir de'),
        patch: { min_price: undefined, max_price: undefined },
      },
      { label: 'Em estoque', patch: { in_stock: undefined } },
    ]);
    expect(filterChips({ sort: 'name' }, undefined)).toEqual([]);
  });

  it('labels open and closed price ranges', () => {
    expect(priceLabel(undefined, undefined)).toBeUndefined();
    expect(priceLabel(undefined, 50000)).toMatch(/^Até R\$\s500,00$/);
    expect(priceLabel(10000, 50000)).toMatch(/^R\$\s100,00 – R\$\s500,00$/);
  });
});

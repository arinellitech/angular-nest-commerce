import { cleanParams } from './catalog.api';

describe('cleanParams', () => {
  it('drops empty values and serializes booleans as 1', () => {
    expect(
      cleanParams({ search: '', category: 'teclados', in_stock: true, page: 2, sort: undefined }),
    ).toEqual({
      category: 'teclados',
      in_stock: '1',
      page: '2',
    });
  });
});

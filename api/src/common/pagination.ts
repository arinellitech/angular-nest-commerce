/**
 * Laravel-compatible pagination envelope so the storefront contract stays the
 * same regardless of backend: `{ data, links, meta }`.
 */
export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: PaginationMeta;
}

export function paginate<T>(
  data: T[],
  options: {
    page: number;
    perPage: number;
    total: number;
    baseUrl: string;
    query: Record<string, string | number | boolean | null | undefined>;
  },
): Paginated<T> {
  const { page, perPage, total, baseUrl, query } = options;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const link = (p: number | null): string | null => {
    if (p === null || p < 1 || p > lastPage) return null;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '' && k !== 'page')
        params.set(k, String(v));
    }
    params.set('page', String(p));
    return `${baseUrl}?${params.toString()}`;
  };

  const from = total === 0 ? null : (page - 1) * perPage + 1;
  const to = total === 0 ? null : Math.min(page * perPage, total);

  return {
    data,
    links: {
      first: link(1),
      last: link(lastPage),
      prev: link(page - 1),
      next: link(page + 1),
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      per_page: perPage,
      to,
      total,
    },
  };
}

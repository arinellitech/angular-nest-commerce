import {
  SearchClient,
  type ProductDocument,
  type ProductSearchFilters,
  type ProductSearchRequest,
  type ProductSearchResult,
} from '../../src/search/search-client.js';

/**
 * In-memory stand-in for Meilisearch with the behaviour the API relies on:
 * every query word must match (matchingStrategy "all"), accents are ignored,
 * typos are tolerated by word length (1 from 5 letters, 2 from 9), the last
 * word also matches as a prefix, filters/sort/pagination, and disjunctive
 * facets (each facet ignores its own filter).
 */
export class InMemorySearchClient extends SearchClient {
  private docs = new Map<number, ProductDocument>();
  /** Simulates an outage: every call rejects. */
  down = false;

  documents(): ProductDocument[] {
    return [...this.docs.values()];
  }

  async configure(): Promise<void> {
    this.assertUp();
  }

  async replaceAll(documents: ProductDocument[]): Promise<void> {
    this.assertUp();
    this.docs = new Map(documents.map((d) => [d.id, d]));
  }

  async upsert(documents: ProductDocument[]): Promise<void> {
    this.assertUp();
    for (const doc of documents) this.docs.set(doc.id, doc);
  }

  async remove(ids: number[]): Promise<void> {
    this.assertUp();
    for (const id of ids) this.docs.delete(id);
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchResult> {
    this.assertUp();
    const terms = tokenize(request.query);
    const matches = this.documents()
      .map((doc) => ({ doc, typos: matchTypos(doc, terms) }))
      .filter(
        (m): m is { doc: ProductDocument; typos: number } => m.typos !== null,
      );

    const hits = matches
      .filter((m) => passes(m.doc, request.filters))
      .sort((a, b) => compare(a, b, request.sort));

    const start = (request.page - 1) * request.perPage;
    const byCategory = matches.filter((m) =>
      passes(m.doc, request.filters, 'category'),
    );
    const prices = matches
      .filter((m) => passes(m.doc, request.filters, 'price'))
      .map((m) => m.doc.price_cents);

    const categories: Record<string, number> = {};
    for (const { doc } of byCategory) {
      if (doc.category)
        categories[doc.category.slug] =
          (categories[doc.category.slug] ?? 0) + 1;
    }

    return {
      ids: hits.slice(start, start + request.perPage).map((m) => m.doc.id),
      total: hits.length,
      facets: {
        categories,
        price: prices.length
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      },
    };
  }

  private assertUp(): void {
    if (this.down) throw new Error('Search engine unavailable (test double).');
  }
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function allowedTypos(word: string): number {
  if (word.length >= 9) return 2;
  if (word.length >= 5) return 1;
  return 0;
}

/** Optimal string alignment distance: insert, delete, substitute, swap neighbours. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** Total typos needed to match every term, or null when some term does not match. */
function matchTypos(doc: ProductDocument, terms: string[]): number | null {
  const words = tokenize(
    [doc.name, doc.sku, doc.category?.name ?? '', doc.description ?? '', ...doc.specs].join(' '),
  );
  let total = 0;
  for (const [index, term] of terms.entries()) {
    const isLast = index === terms.length - 1;
    let best: number | null = null;
    for (const word of words) {
      if (word === term || (isLast && word.startsWith(term))) {
        best = 0;
        break;
      }
      const typos = distance(term, word);
      if (typos <= allowedTypos(term) && (best === null || typos < best))
        best = typos;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

function passes(
  doc: ProductDocument,
  filters: ProductSearchFilters,
  omit?: 'category' | 'price',
): boolean {
  if (!doc.published) return false;
  if (
    omit !== 'category' &&
    filters.categorySlugs &&
    !filters.categorySlugs.includes(doc.category?.slug ?? '')
  )
    return false;
  if (omit !== 'price') {
    if (
      filters.minPriceCents !== undefined &&
      doc.price_cents < filters.minPriceCents
    )
      return false;
    if (
      filters.maxPriceCents !== undefined &&
      doc.price_cents > filters.maxPriceCents
    )
      return false;
  }
  return !filters.inStock || doc.in_stock;
}

function compare(
  a: { doc: ProductDocument; typos: number },
  b: { doc: ProductDocument; typos: number },
  sort: ProductSearchRequest['sort'],
): number {
  const bySort = {
    relevance: 0,
    newest: b.doc.published_at - a.doc.published_at,
    price_asc: a.doc.price_cents - b.doc.price_cents,
    price_desc: b.doc.price_cents - a.doc.price_cents,
    name: a.doc.name.localeCompare(b.doc.name),
  }[sort];
  return bySort || a.typos - b.typos || a.doc.id - b.doc.id;
}

# Commerce API — reference

Base URL: `/api/v1`. All responses are JSON. Interactive OpenAPI docs at `/api/docs` (non-production).
Money is `{ amount: <int cents>, currency: "BRL", formatted: "R$ 199,90" }`.
Single resources are wrapped in `{ data: {...} }`; collections in `{ data: [...], links: {...}, meta: { current_page, from, last_page, per_page, to, total } }`.
Errors: `{ message, errors?: { field: [..] } }` with 404 / 422 / 401 / 409 / 429.

## Implemented (starter)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | DB check; 200 ok / 503 degraded |
| GET | `/categories` | active root categories + children, `products_count` (includes subcategories) |
| GET | `/categories/{slug}` | |
| GET | `/products` | query: `search, category, min_price, max_price (cents), in_stock, sort(relevance\|newest\|price_asc\|price_desc\|name), page, per_page(<=60)`. `category` includes its subcategories. Default sort: `relevance` with `search`, `newest` otherwise. With `search`: Meilisearch + `meta.facets` (see below) |
| GET | `/products/{slug}` | 404 unless active + published |

### Search (PROMPT 01)

`GET /products?search=…` queries the Meilisearch index `products` (typo tolerance, accents ignored, every word must match) and hydrates the hits from Postgres in ranking order, so price, stock and visibility always come from the database. Without `search` the endpoint is a plain SQL query. If Meilisearch is unreachable the API logs a warning and answers from SQL (`ILIKE`, no facets) instead of failing.

`meta.facets` (only with `search`) is disjunctive: category counts ignore the `category` filter and the price range ignores `min_price`/`max_price`, so the storefront can offer the alternatives.

```json
"meta": {
  "current_page": 1, "from": 1, "last_page": 1, "per_page": 24, "to": 2, "total": 2,
  "facets": {
    "categories": [{ "slug": "teclados", "name": "Teclados", "count": 2 }],
    "price": { "min": { "amount": 27990, "currency": "BRL", "formatted": "R$ 279,90" },
               "max": { "amount": 34990, "currency": "BRL", "formatted": "R$ 349,90" } }
  }
}
```

Index maintenance: `npm run search:configure` (settings), `npm run search:reindex` (full rebuild, the index keeps serving meanwhile; also run by `db:seed`). Every catalog write must call `CatalogService.syncSearchIndex(ids)`. Until it does, hits are still re-filtered by visibility, price and stock in Postgres (stale ones are dropped and subtracted from `total`); only facet counts may lag. Only published + active products are indexed; a product scheduled for the future enters the index on the next reindex/sync after its `published_at`.

## Planned (see /PROMPTS.md)

| Method | Path | Prompt |
| --- | --- | --- |
| POST | `/cart` | 02 — creates guest cart, returns `X-Cart-Token` |
| GET | `/cart` | 02 |
| POST | `/cart/items` `{ product_id, quantity }` | 02 |
| PATCH | `/cart/items/{id}` `{ quantity }` | 02 |
| DELETE | `/cart/items/{id}` | 02 |
| POST / DELETE | `/cart/coupon` `{ code }` | 02 |
| POST | `/checkout` (header `Idempotency-Key`) | 03 — reserves stock, creates order + payment |
| GET | `/orders/{number}` | 03 |
| POST | `/webhooks/{provider}` | 04 — idempotent via `webhook_events (provider, external_id)` |
| POST | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh` | 05 — JWT (Passport) |
| GET | `/me`, `/me/orders` | 05 |

## Headers

- `X-Cart-Token`: opaque guest cart token. Returned by `POST /cart`; sent by the storefront on every cart call.
- `Idempotency-Key`: client-generated UUID for `POST /checkout`. Same key → same order (HTTP 200 instead of 201).
- `Authorization: Bearer <jwt>` for logged-in customers.
- `X-Webhook-Secret`: shared secret for the mock provider's webhook.

## Resource shapes

```ts
// Mirrors storefront/src/app/core/api/types.ts
interface Product {
  id: number; name: string; slug: string; sku: string; description: string | null;
  price: Money; compare_at_price?: Money; specs: Record<string, string>;
  in_stock: boolean | null; available_quantity: number | null;
  category?: Category; images?: ProductImage[]; published_at: string | null;
}
interface Category { id: number; name: string; slug: string; description: string | null; position: number; products_count?: number; children?: Category[] }
interface ProductImage { id: number; url: string; alt: string | null; position: number }
interface ProductFacets { categories: { slug: string; name: string; count: number }[]; price: { min: Money; max: Money } | null }
type ProductPage = Paginated<Product> & { meta: { facets?: ProductFacets } }  // GET /products
```

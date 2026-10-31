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

### Cart (PROMPT 02)

A guest cart is identified by the opaque `X-Cart-Token` returned by `POST /cart` (header **and** `data.token`; the header is exposed to CORS). Every other cart route requires it and answers `404` when the token is missing, unknown, expired or already converted into an order. Each use renews `expires_at` (`CART_TTL_DAYS`, default 30). Authenticated carts arrive with PROMPT 05.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | `/cart` | 201 new empty cart | |
| GET | `/cart` | 200 | 404 |
| POST | `/cart/items` `{ product_id, quantity }` | 201 cart | 404 · 422 `errors.product_id` (unknown/unpublished), `errors.quantity` (stock, max 99 per line) |
| PATCH | `/cart/items/{id}` `{ quantity }` | 200 cart | 404 (item not in this cart) · 422 `errors.quantity` |
| DELETE | `/cart/items/{id}` | 200 cart | 404 |
| POST | `/cart/coupon` `{ code }` | 200 cart | 422 `errors.code` |
| DELETE | `/cart/coupon` | 200 cart (idempotent) | 404 |

Every success body is `{ data: Cart }`:

```json
{
  "data": {
    "id": "5f0c…", "token": "k3Jx…", "currency": "BRL", "status": "active",
    "items": [{
      "id": 12,
      "product": { "id": 3, "name": "Teclado Mecânico", "slug": "teclado-mecanico",
                   "images": [{ "id": 7, "url": "https://…", "alt": "…", "position": 0 }] },
      "quantity": 2,
      "unit_price": { "amount": 4000, "currency": "BRL", "formatted": "R$ 40,00" },
      "total":      { "amount": 8000, "currency": "BRL", "formatted": "R$ 80,00" },
      "available_quantity": 10
    }],
    "coupon": { "code": "BEMVINDO10", "discount": { "amount": 800, "currency": "BRL", "formatted": "R$ 8,00" } },
    "subtotal": { "amount": 8000 }, "discount": { "amount": 800 },
    "shipping": { "amount": 1990 }, "total": { "amount": 9190 },
    "expires_at": "2026-11-30T12:00:00.000Z"
  }
}
```

Rules:

- **Price snapshot**: `unit_price` is the price when the line was last added/changed (adding again or PATCH refreshes it); checkout re-validates against the live product.
- **Stock is checked, not reserved**: a line may not exceed `quantity - reserved` (the sum with what is already in the cart counts). The reservation happens at checkout (PROMPT 03). `available_quantity` is `0` for a product that left the catalog.
- **Totals** (integer cents): `subtotal = Σ quantity × unit_price`; `discount` from the coupon (percent rounds down, never above the subtotal); `shipping = SHIPPING_FLAT_RATE_CENTS`, free when `subtotal - discount >= SHIPPING_FREE_OVER_CENTS`, `0` for an empty cart.
- **Coupon**: code is case-insensitive. Rejections come back as `422 { message: "Coupon not applicable.", errors: { code: ["…"] } }` (unknown/inactive, not started, expired, usage limit reached, below the minimum subtotal). A coupon whose minimum is no longer met after an item change is detached automatically. Usage (`uses`) is only counted at checkout.

## Planned (see /PROMPTS.md)

| Method | Path | Prompt |
| --- | --- | --- |
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
// Cart (see "Cart" above): items[].available_quantity is new in PROMPT 02
```

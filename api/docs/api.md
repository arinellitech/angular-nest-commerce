# Commerce API — reference

Base URL: `/api/v1`. All responses are JSON. Interactive OpenAPI docs at `/api/docs` (non-production).
Money is `{ amount: <int cents>, currency: "BRL", formatted: "R$ 199,90" }`.
Single resources are wrapped in `{ data: {...} }`; collections in `{ data: [...], links: {...}, meta: { current_page, from, last_page, per_page, to, total } }`.
Errors: `{ message, errors?: { field: [..] } }` with 404 / 422 / 401 / 409 / 429.

## Implemented (starter)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | DB check; 200 ok / 503 degraded |
| GET | `/categories` | active root categories + children, `products_count` |
| GET | `/categories/{slug}` | |
| GET | `/products` | query: `search, category, min_price, max_price, in_stock, sort(newest|price_asc|price_desc|name), page, per_page(<=60)` |
| GET | `/products/{slug}` | 404 unless active + published |

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
```

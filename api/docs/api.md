# Commerce API — reference

Base URL: `/api/v1`. All responses are JSON. Interactive OpenAPI docs at `/api/docs` (non-production).
Money is `{ amount: <int cents>, currency: "BRL", formatted: "R$ 199,90" }`.
Single resources are wrapped in `{ data: {...} }`; collections in `{ data: [...], links: {...}, meta: { current_page, from, last_page, per_page, to, total } }`.
Errors: `{ message, errors?: { field: [..] } }` with 400 / 401 / 404 / 409 / 422 / 429 / 502.

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
- **Stock is checked, not reserved**: a line may not exceed `quantity - reserved` (the sum with what is already in the cart counts). The reservation happens at checkout (see below). `available_quantity` is `0` for a product that left the catalog.
- **Totals** (integer cents): `subtotal = Σ quantity × unit_price`; `discount` from the coupon (percent rounds down, never above the subtotal); `shipping = SHIPPING_FLAT_RATE_CENTS`, free when `subtotal - discount >= SHIPPING_FREE_OVER_CENTS`, `0` for an empty cart.
- **Coupon**: code is case-insensitive. Rejections come back as `422 { message: "Coupon not applicable.", errors: { code: ["…"] } }` (unknown/inactive, not started, expired, usage limit reached, below the minimum subtotal). A coupon whose minimum is no longer met after an item change is detached automatically. Usage (`uses`) is only counted at checkout.

### Checkout & orders (PROMPT 03)

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | `/checkout` — headers `X-Cart-Token`, `Idempotency-Key` | 201 new order · 200 replay of the same key | 400 (key missing / not a UUID) · 404 (cart unknown, expired or converted by another key) · 422 (see below) · 502 (provider failed; retry with the same key) |
| GET | `/orders/{number}` — `X-Cart-Token` **or** `?token=` | 200, `Cache-Control: private, no-store` | 404 (unknown number **or** no valid credential) |

`POST /checkout` body (strings are trimmed; punctuation in CPF, phone and CEP is accepted and stripped):

```json
{
  "customer": { "name": "Ana Souza", "email": "ana@example.com", "document": "529.982.247-25", "phone": "(11) 98765-4321" },
  "shipping_address": { "line1": "Av. Paulista, 1000", "line2": "Apto 12", "city": "São Paulo", "state": "SP", "postal_code": "01310-100", "country": "BR" },
  "payment_method": "pix"
}
```

- `customer.document`: valid CPF (check digits) → stored as 11 digits, returned masked (`***.982.247-**`). `customer.phone`: 10–11 digits with area code. `shipping_address.state`: one of the 27 UFs. `postal_code`: 8 digits. `country`: `BR` only (missing or `null` → `BR`). `line2` optional.
- `payment_method`: `pix | card | boleto`; the active provider decides which are accepted (mock: `pix` only), otherwise `422 errors.payment_method`.
- Validation errors use dotted paths: `errors["customer.document"]`, `errors["shipping_address.postal_code"]`, …

**What happens, in one transaction** (`SELECT … FOR UPDATE` on the cart row, then on the inventory rows in product-id order so concurrent checkouts queue instead of deadlocking; the coupon row is locked too):

1. Every line is re-validated against the live product: still published (else `unavailable`) and `quantity - reserved >= line quantity` (else `insufficient_stock`). All problems come back at once and nothing is reserved:
   ```json
   422 { "message": "Some items are no longer available.",
         "errors": { "items": ["Cadeira: apenas 1 unidade disponível.", "Luminária não está mais disponível."] },
         "unavailable": [{ "product_id": 7, "name": "Cadeira", "requested": 3, "available": 1, "reason": "insufficient_stock" },
                         { "product_id": 9, "name": "Luminária", "requested": 1, "available": 0, "reason": "unavailable" }] }
   ```
   An empty cart is `422 errors.cart`.
2. **Price**: the order charges the live price. When it differs from the cart snapshot, the snapshot is refreshed and checkout continues (the storefront compares the order total with the cart it showed).
3. **Coupon**: re-checked against the live subtotal. Still redeemable → discount applied and `coupons.uses + 1` (row locked, so `max_uses` holds under concurrency). No longer redeemable → the order goes through without it, exactly as `GET /cart` already showed (`coupon: null`).
4. `inventory.reserved += quantity` per line (the DB CHECK `0 <= reserved <= quantity` backs the lock) and one `stock_movements` row per line: `type=reserved`, `quantity=+n`, `reference_type=order`, `reference_id=<order id>`.
5. Order number `ORD-YYYY-NNNNNN` from the Postgres sequence `order_number_seq` (never `count()`; year in Brasília time; rolled-back checkouts leave gaps). Order + items (name/sku/price snapshots) + a `pending` payment row with `expires_at = now + ORDER_PAYMENT_TTL_MINUTES`. Cart → `converted`.

After the commit (no network calls inside the transaction) the provider creates the charge (`PaymentGateway.charge(order, method, idempotencyKey)`, keyed by our payment id, so concurrent or retried calls reach the same charge at the provider); its reference and Pix data are stored on the payment and the `order.placed` event fires, once. Its listener e-mails the customer (summary, Pix code, signed link to the order page); a mail failure is logged and never fails the checkout. If the provider fails, the response is `502` but the order and its reservation stay: resending the same key creates the charge and answers `200`.

**Idempotency-Key** (UUID generated by the client once per attempt and reused on every retry; case-insensitive):

- The first request with a key creates the order (`201`). Any later request with the same key **and the same cart token** returns that order with `200`, even after the cart was converted and even if the first attempt died before charging. Nothing is reserved twice and the e-mail goes out once.
- The same key with another cart → `422 errors.idempotency_key` (the order is not disclosed).
- Concurrent requests with one key serialize on the cart row lock; the later ones find the cart converted and answer as replays. The same key from two carts at the same instant: the unique index on `orders.idempotency_key` + `ON CONFLICT DO NOTHING` lets one insert win; the other rolls back its reservation and gets the `422`.
- A different key on an already converted cart → `404` (the cart is gone).

**Reading an order** — `GET /orders/{number}`. Decision: an order is readable by whoever proves a link to it, and every failure is the same `404`, so sequential numbers cannot be probed.

| Credential | Who has it |
| --- | --- |
| `X-Cart-Token` of the cart the order came from | the browser that checked out (while it keeps the token) |
| `?token=<access_token>` | anyone with the e-mail link; also returned as `data.access_token` so the storefront puts it in the order page URL. HMAC-SHA256 of the order id with `ORDER_LINK_SECRET`: stateless, no expiry, grants reading this one order only |
| `Authorization: Bearer` of the owner | PROMPT 05 (customer accounts) |

The response is `private, no-store` (personal data) and the CPF is masked.

```json
{
  "data": {
    "id": "0b6f0e1e-…", "number": "ORD-2026-000042", "status": "pending_payment", "currency": "BRL",
    "customer": { "name": "Ana Souza", "email": "ana@example.com", "document": "***.982.247-**", "phone": "11987654321" },
    "shipping_address": { "line1": "Av. Paulista, 1000", "line2": "Apto 12", "city": "São Paulo", "state": "SP", "postal_code": "01310100", "country": "BR" },
    "items": [{
      "id": 81, "product_id": 3, "slug": "teclado-mecanico",
      "image": { "id": 7, "url": "https://…", "alt": "…", "position": 0 },
      "name": "Teclado Mecânico", "sku": "SKU-10003", "quantity": 2,
      "unit_price": { "amount": 4000, "currency": "BRL", "formatted": "R$ 40,00" },
      "total":      { "amount": 8000, "currency": "BRL", "formatted": "R$ 80,00" }
    }],
    "coupon": { "code": "BEMVINDO10" },
    "subtotal": { "amount": 8000 }, "discount": { "amount": 800 }, "shipping": { "amount": 1990 }, "total": { "amount": 9190 },
    "payment": {
      "id": "6c1d…", "provider": "mock", "method": "pix", "status": "pending",
      "amount": { "amount": 9190, "currency": "BRL", "formatted": "R$ 91,90" },
      "pix_copy_paste": "00020126580014br.gov.bcb.pix…", "pix_qr_code": null,
      "expires_at": "2026-10-31T15:30:00.000Z", "confirmed_at": null
    },
    "access_token": "Xqd1ssMNpkxMhqgOhCjGXUdnMh3e3qBENTdlecgyM2k",
    "placed_at": "2026-10-31T15:00:00.000Z", "paid_at": null, "cancelled_at": null
  }
}
```

`items[].product_id`, `slug` and `image` become `null` once the product is deleted (name, sku and prices are snapshots and stay). `payment` is `null` only while the provider has not created the charge (after a `502`). `status`: `pending_payment | paid | fulfilled | cancelled | refunded` (payment-driven transitions arrive in PROMPT 04).

Concurrency is tested against real PostgreSQL in `test/checkout.concurrency.e2e-spec.ts` (runs when `DATABASE_URL` is set, inside a throwaway database it creates and drops): last unit raced by two buyers, 8 buyers for 3 units, opposite lock orders, concurrent retries of one key, one key from two carts, last coupon use. PGlite (single connection) covers the sequential cases.

## Planned (see /PROMPTS.md)

| Method | Path | Prompt |
| --- | --- | --- |
| POST | `/webhooks/{provider}` | 04 — idempotent via `webhook_events (provider, external_id)` |
| POST | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh` | 05 — JWT (Passport) |
| GET | `/me`, `/me/orders` | 05 |

## Headers

- `X-Cart-Token`: opaque guest cart token. Returned by `POST /cart`; sent by the storefront on every cart call and on `POST /checkout`. Also grants read access to the orders placed from that cart.
- `Idempotency-Key`: client-generated UUID for `POST /checkout`, required (400 without it). Same key + same cart → same order (HTTP 200 instead of 201); same key + another cart → 422.
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
type OrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';
type PaymentMethod = 'pix' | 'card' | 'boleto';
type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded' | 'expired';
interface CheckoutRequest {
  customer: { name: string; email: string; document: string; phone: string };
  shipping_address: { line1: string; line2?: string; city: string; state: string; postal_code: string; country?: 'BR' };
  payment_method: PaymentMethod;
}
interface OrderItem { id: number; product_id: number | null; slug: string | null; image: ProductImage | null; name: string; sku: string; quantity: number; unit_price: Money; total: Money }
interface Payment { id: string; provider: string; method: PaymentMethod; status: PaymentStatus; amount: Money; pix_copy_paste: string | null; pix_qr_code: string | null; expires_at: string | null; confirmed_at: string | null }
interface Order {
  id: string; number: string; status: OrderStatus; currency: string;
  customer: { name: string; email: string; document: string; phone: string | null };
  shipping_address: { line1: string; line2: string | null; city: string; state: string; postal_code: string; country: string };
  items: OrderItem[]; coupon: { code: string } | null;
  subtotal: Money; discount: Money; shipping: Money; total: Money;
  payment: Payment | null; access_token: string;
  placed_at: string | null; paid_at: string | null; cancelled_at: string | null;
}
// Extra field on the 422 of POST /checkout when lines cannot be bought
interface UnavailableLine { product_id: number; name: string; requested: number; available: number; reason: 'unavailable' | 'insufficient_stock' }
```

---
paths:
  - "api/**"
---
# NestJS API conventions

## Structure
- One Nest module per bounded context under `src/<context>/` (`catalog`, `cart`, `checkout`, `orders`, `payments`, `webhooks`, `auth`). Controllers are thin; business rules live in services or pure functions (`order-status.ts`, `coupon.rules.ts`) that are unit-tested without Nest.
- ESM project: every relative import ends in `.js` (`./catalog.service.js`), `import type` for types.
- Validation only in DTO classes (`dto/*.dto.ts`) with class-validator + class-transformer; the global pipe (`src/common/validation.ts`) returns 422 `{ message, errors: { field: [...] } }`. Never read `req.body` directly in controllers.
- Output through mapper functions (`*.mappers.ts`) returning the resource shapes documented in `docs/api.md`. Money is always `toMoney(cents)`. Collections use `paginate()` from `src/common/pagination.ts`.
- Status/type values are `as const` unions (`OrderStatus`, `PaymentStatus`), stored as text, never TS enums.
- Config is read only through `ConfigService<Env, true>` with `{ infer: true }`; add new vars to `src/config/env.ts` (zod) and to `.env.example`.
- Payment providers extend `PaymentGateway` and are registered in `payments.module.ts` → `GATEWAYS`. Checkout code never references a concrete provider.
- Swagger: decorate DTOs/controllers (`@ApiTags`, `@ApiOkResponse`); the CLI plugin infers the rest.

## Database (Drizzle)
- `src/database/schema.ts` is the source of truth. After changing it: `npm run db:generate` (creates SQL in `drizzle/`), review the SQL, commit it. `npm run db:migrate` applies. Never `drizzle-kit push` against a shared database.
- Inject the handle with `@Inject(DRIZZLE) private readonly db: Database`. Use `db.query.<table>.findMany({ with })` for reads with relations; the query builder for aggregates/updates.
- Invariants in the DB: CHECK constraints in the schema (`check()`), unique indexes for idempotency keys. Always pair a constraint with a Pest-style e2e test that proves the API returns 409/422 instead of 500.
- Locks: `await tx.select().from(inventory).where(...).for('update')` inside `db.transaction(async (tx) => …)`. Keep transactions short; no HTTP calls inside them.
- `onConflictDoNothing()` / `onConflictDoUpdate()` for idempotent inserts (webhook events, idempotency keys).
- Primary keys: identity integers for catalog, `uuid` for carts/orders/payments (public). Timestamps `withTimezone`.

## Testing (Vitest)
- Unit tests next to the code (`*.spec.ts`) for pure logic; no Nest container.
- E2E tests in `test/*.e2e-spec.ts` using `createTestApp()` (PGlite, real migrations, real pipes/filters) and `factories(db)`. Cover happy path, 422, 404 and the invariant edge case (e.g. reserving more than available → 422).
- Environment for e2e lives in `vitest.config.e2e.ts` (`test.env`), not in test files. One exception: `test/checkout.concurrency.e2e-spec.ts` switches `DATABASE_DRIVER` to `pg` with `vi.stubEnv` before importing the app, because row locks need real concurrent connections (PGlite has one).
- `npm run lint && npm run typecheck && npm test && npm run test:e2e` must be clean before finishing.

## Security
- Public catalog routes are cacheable and unauthenticated. Everything that mutates goes through the cart token (`X-Cart-Token`) or `@UseGuards(JwtAuthGuard)`.
- Webhooks: verify signature → insert `webhook_events` (unique) → enqueue processing. Return 200 for duplicates.
- Never log request bodies containing documents (CPF) or card data. Mask before storing in `payload` jsonb.
- Rate limiting via `@nestjs/throttler` (global guard already registered); tighten per route with `@Throttle()`.

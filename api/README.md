# Commerce API (NestJS 12 + Drizzle + PostgreSQL)

JSON API consumed by `../storefront`. See the root [README](../README.md) for setup and [`docs/api.md`](docs/api.md) for the HTTP contract. OpenAPI UI at `http://localhost:8000/api/docs`.

```bash
npm run setup        # install + migrate + seed (needs DATABASE_URL, default = docker compose postgres)
npm run start:dev    # http://localhost:8000/api/v1
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

- `npm test` — unit tests (pure functions: money, coupons, order state machine).
- `npm run test:e2e` — boots the real app on **PGlite** (in-memory Postgres, WASM) with all migrations applied. No Docker needed.
- `npm run db:generate` — regenerate SQL migrations from `src/database/schema.ts` after a schema change; `npm run db:migrate` applies them.

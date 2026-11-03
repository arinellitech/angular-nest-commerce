# Progress log

One line per finished prompt (see PROMPTS.md). The SessionStart hook prints the tail of this file.

- 2026-10-22 · STARTER · NestJS 12 API (Drizzle schema + migration, catalog endpoints, payment contract, Swagger, Vitest e2e on PGlite) + Angular 22 storefront (SSR home, catalog, product page, Vercel wrapper) + Claude Code config · 29 API tests, 4 storefront tests
- 2026-10-22 · PROMPT 00 done · setup + angular skills · 33 tests
- 2026-10-22 · PROMPT 01 done · busca com meilisearch (facets disjuntivos, fallback SQL, autocomplete com debounce, categoria inclui subcategorias) · 78 tests (api 31 unit + 27 e2e, storefront 20)
- 2026-10-31 · PROMPT 02 done · carrinho de convidado (X-Cart-Token, CartGuard, snapshot de preço, cupons) + CartStore SignalStore, /cart, badge no header, PDP com snackbar · 131 tests (api 37 unit + 50 e2e, storefront 44)
- 2026-11-03 · PROMPT 03 done · checkout idempotente (Idempotency-Key, FOR UPDATE, sequence ORD-YYYY-NNNNNN, mock Pix, order.placed → Mailpit, links assinados) + /checkout stepper ViaCEP, /orders/:number QR Pix, recovery pós-502 · 198 tests (api 54 unit + 76 e2e PGlite + 6 concurrency PG, storefront 68)

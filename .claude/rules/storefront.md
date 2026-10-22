---
paths:
  - "storefront/**"
---
# Angular 22 storefront conventions

`storefront/CLAUDE.md` (official Angular best practices) applies first. These are project-specific additions.

## Structure
- `src/app/core/` — cross-cutting: `api/` (types, interceptor, `httpResource` factories, cart token), `config/` (API base URL token). `src/app/shared/` — reusable UI (`ui/`), pipes, pure utils. `src/app/features/<feature>/` — routed components (lazy via `loadComponent`), feature stores and feature-only components. `src/app/layout/` — header/footer.
- File naming follows the 2025 style guide (`product-card.ts`, class `ProductCard`), no `.component` suffix. Selectors `app-*`.
- Templates inline unless they exceed ~80 lines; then `templateUrl` with a sibling `.html`.
- Data fetching: `httpResource` factories in `core/api/*.api.ts` created in field initializers (injection context). Never hard-code the API host; call `/api/v1/...` and let `apiInterceptor` prefix it.
- Route params and query params arrive as inputs (`withComponentInputBinding`); filters live in the URL so pages are shareable and cacheable.
- State: component signals for local state; NgRx SignalStore (`@ngrx/signals`) for shared state (cart, auth) under `features/<feature>/<feature>.store.ts`. Stores call the API via `HttpClient` (`rxResource`/`httpResource` for reads, `firstValueFrom(http.post(...))` for writes).
- Forms: Signal Forms (`@angular/forms/signals`, stable in v22) with schema validation; map API 422 `errors[field][0]` back onto the field.
- UI: Angular Material 22 components + Tailwind 4 utilities. Prebuilt theme in `styles.css`; no other UI library. Icons via Material Symbols (`<mat-icon>` / `.material-symbols-outlined`).

## SSR
- Every new route gets an entry in `app.routes.server.ts`: `RenderMode.Server` (+ cache headers) for public pages, `RenderMode.Client` for anything depending on cookies/auth, `status: 404` where applicable.
- No `window`/`document` access outside `afterNextRender`/`isPlatformBrowser` guards; inject `DOCUMENT` for DOM access.
- Set HTTP status from components with `inject(RESPONSE_INIT)` (see `product-page.ts`).
- Images: `NgOptimizedImage` with explicit `width`/`height`/`sizes`; mark the LCP image `priority`.
- New external hosts the SSR server may receive must be added to `angular.json → security.allowedHosts` or `NG_ALLOWED_HOSTS`.

## Quality
- `npm run lint:fix && npm run typecheck && npm test && npm run build` must pass before finishing.
- Unit tests with Vitest + TestBed (`*.spec.ts` next to the code); `provideRouter([])` and `provideHttpClientTesting()` as needed. Playwright e2e under `e2e/` (prompt 07).
- No `any`, no `// eslint-disable` without a one-line reason. Accessibility: labels on inputs, `aria-*` on icon buttons, keyboard-reachable controls.

---
name: storefront-feature
description: Build a storefront feature in storefront/ (route, components, SignalStore or httpResource, Signal Forms, Vitest specs, SSR route entry). Use for "cart page", "checkout flow", "order status page" or any Angular UI work.
argument-hint: "[feature, e.g. 'cart page with quantity controls and coupon input']"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npm *), Bash(npx *), Bash(node *), Bash(ng *), mcp__angular-cli__*, mcp__context7__*
---
Build the storefront feature: **$ARGUMENTS**

Work inside `storefront/`. Follow `storefront/CLAUDE.md` and `.claude/rules/storefront.md`.

## Steps

1. **Contract**: read `src/app/core/api/types.ts` and `../api/docs/api.md`. If the endpoint you need is not implemented yet, stop and say so (the API slice comes first).
2. **Generate**: `npx ng generate component features/<feature>/<name> --inline-template --skip-tests=false` (or write by hand following the 2025 file-name style). Use the Angular MCP `get_best_practices` once per session.
3. **Data layer**: reads via `httpResource` factories in `core/api/<context>.api.ts`; shared mutable state via NgRx SignalStore in `features/<feature>/<feature>.store.ts` (`withState`, `withComputed`, `withMethods`, `rxMethod`/`firstValueFrom`). Surface API 422 errors as `{ field: message }`.
4. **UI**: Angular Material 22 + Tailwind 4. Signal Forms for forms with schema validation and inline API errors. Loading skeleton, empty state, error state. Labels/aria on every control.
5. **Routing/SSR**: add the route to `app.routes.ts` (lazy, with `title`) and the render mode to `app.routes.server.ts` (`Client` for cookie/auth-dependent pages).
6. **Tests**: Vitest + TestBed for components with logic; store specs with `provideHttpClientTesting()`.
7. **Verify**: `npm run lint:fix && npm run typecheck && npm test && npm run build`.

Finish with: routes/components/stores added and a one-paragraph description of the UX, so it can be pasted into the README.

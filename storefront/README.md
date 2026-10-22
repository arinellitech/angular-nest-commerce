# Storefront (Angular 22 · SSR · Tailwind 4 · Angular Material)

Consumes `../api`. See the root [README](../README.md).

```bash
npm install
npm start                 # http://localhost:4200 (dev server with SSR, API at http://localhost:8000)
npm run lint && npm run typecheck && npm test
npm run build && npm run serve:ssr   # production SSR server on :4000 (API_BASE_URL env var)
```

- Routes and render modes: `src/app/app.routes.ts` + `src/app/app.routes.server.ts` (catalog = SSR + CDN cache headers; cart/checkout/account = client-only).
- API access: `src/app/core/api/*` — `httpResource` + an interceptor that prefixes `/api/...` with the base URL and forwards the guest cart token.
- API base URL at runtime: `API_BASE_URL` / `PUBLIC_API_BASE_URL` env vars → `REQUEST_CONTEXT` → `TransferState` (`src/app/core/config/api-base-url.ts`).
- Vercel: `vercel.json` + `api/index.js` wrap the SSR handler in a serverless function; static assets come from `dist/storefront/browser`.

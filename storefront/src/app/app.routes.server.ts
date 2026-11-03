import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render strategy per route. Catalog pages are server-rendered with CDN cache
 * headers (Vercel honors `s-maxage` + `stale-while-revalidate`); cart,
 * checkout and account are client-only because they depend on cookies.
 */
const cached = (seconds: number) => ({
  'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}`,
});

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server, headers: cached(300) },
  { path: 'products', renderMode: RenderMode.Server, headers: cached(60) },
  { path: 'products/:slug', renderMode: RenderMode.Server, headers: cached(60) },
  { path: 'cart', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'orders/:number', renderMode: RenderMode.Client },
  { path: 'account/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];

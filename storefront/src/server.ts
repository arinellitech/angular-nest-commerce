import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import type { ServerRequestContext } from './app/core/config/api-base-url';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * Host-header allowlist (SSRF protection, Angular ≥ 21). Static hosts live in
 * angular.json → security.allowedHosts (localhost, *.vercel.app). Add custom
 * domains at runtime with NG_ALLOWED_HOSTS="loja.com.br,*.loja.com.br".
 */
const angularApp = new AngularNodeAppEngine();

/**
 * Runtime configuration for the API location (see core/config/api-base-url.ts):
 *   API_BASE_URL         URL the SSR server uses (may be internal)
 *   PUBLIC_API_BASE_URL  URL the browser uses (defaults to API_BASE_URL)
 * Both default to the compiled environment when unset.
 */
const requestContext: ServerRequestContext = {
  apiBaseUrl: process.env['API_BASE_URL'],
  publicApiBaseUrl: process.env['PUBLIC_API_BASE_URL'] ?? process.env['API_BASE_URL'],
};

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req, requestContext)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Storefront SSR listening on http://localhost:${port}`);
  });
}

/** Request handler used by the Angular CLI dev server and by Vercel (api/index.js). */
export const reqHandler = createNodeRequestHandler(app);

/**
 * Production defaults. Overridden at runtime by the SSR server (API_BASE_URL /
 * PUBLIC_API_BASE_URL env vars → REQUEST_CONTEXT → TransferState), see
 * src/app/core/config/api-base-url.ts. Replaced by environment.development.ts
 * in `ng serve` (fileReplacements in angular.json).
 */
export const environment = {
  production: true,
  // Public URL of the API (prompt 08 points this at the deployed API).
  apiBaseUrl: 'https://arinelli-commerce-api.fly.dev',
  siteName: 'Loja Demo',
};

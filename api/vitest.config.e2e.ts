import { defineConfig } from 'vitest/config';

/**
 * E2E tests boot the real Nest app on PGlite (in-memory Postgres, WASM).
 * No Docker, no DATABASE_URL needed. Env is injected here because
 * ConfigModule reads process.env when AppModule is imported.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_DRIVER: 'pglite',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
      ORDER_LINK_SECRET: 'test-order-link-secret-0123456789abcdef',
      FRONTEND_URL: 'http://localhost:4200',
      CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

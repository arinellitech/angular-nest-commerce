import { z } from 'zod';

/**
 * Environment contract. Validated once at boot by ConfigModule; anything
 * missing or malformed fails fast with a readable message.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  APP_URL: z.url().default('http://localhost:8000'),

  // pg (default) talks to PostgreSQL via DATABASE_URL.
  // pglite runs an in-memory Postgres (WASM) — used by the test suite.
  DATABASE_DRIVER: z.enum(['pg', 'pglite']).default('pg'),
  DATABASE_URL: z
    .string()
    .default('postgres://commerce:commerce@127.0.0.1:5432/commerce'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Comma-separated list of allowed storefront origins.
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:4200'),

  COMMERCE_CURRENCY: z.string().length(3).default('BRL'),
  CART_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ORDER_NUMBER_PREFIX: z.string().default('ORD'),
  ORDER_PAYMENT_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  SHIPPING_FLAT_RATE_CENTS: z.coerce.number().int().nonnegative().default(1990),
  SHIPPING_FREE_OVER_CENTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(29900),

  PAYMENT_PROVIDER: z
    .enum(['mock', 'asaas', 'pagarme', 'stripe'])
    .default('mock'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(8).default('change-me'),

  MEILISEARCH_HOST: z.url().default('http://127.0.0.1:7700'),
  MEILISEARCH_KEY: z.string().default('masterKey'),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

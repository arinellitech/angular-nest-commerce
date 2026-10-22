/**
 * Wiring for the tsx scripts (seed, search:configure, search:reindex).
 * tsx (esbuild) does not emit decorator metadata, so instead of booting a Nest
 * container the scripts build the few objects they need by hand.
 */
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { CatalogService } from '../catalog/catalog.service.js';
import { validateEnv, type Env } from '../config/env.js';
import type { Database } from '../database/database.module.js';
import * as schema from '../database/schema.js';
import { createMeilisearch, MeilisearchClient } from './meilisearch.client.js';
import { SearchService } from './search.service.js';

export function loadEnv(): Env {
  return validateEnv(process.env);
}

export function createSearchService(env: Env): SearchService {
  return new SearchService(new MeilisearchClient(createMeilisearch(env)));
}

export function reindexCatalog(db: Database, env: Env): Promise<number> {
  const catalog = new CatalogService(
    db,
    createSearchService(env),
    new ConfigService<Env, true>(env),
  );
  return catalog.reindexSearch();
}

export async function withDatabase<T>(
  env: Env,
  run: (db: Database) => Promise<T>,
): Promise<T> {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  try {
    return await run(drizzle(pool, { schema }));
  } finally {
    await pool.end();
  }
}

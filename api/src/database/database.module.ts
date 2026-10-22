import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

export const DRIZZLE = Symbol('DRIZZLE');

/**
 * The database handle injected everywhere: `@Inject(DRIZZLE) private readonly db: Database`.
 * In production it is node-postgres; in tests it is PGlite (same Postgres
 * dialect, in-memory, no Docker). Both expose the same Drizzle API.
 */
export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

const DATABASE_HANDLE = Symbol('DATABASE_HANDLE');

async function createHandle(
  config: ConfigService<Env, true>,
): Promise<DatabaseHandle> {
  const logger = new Logger('Database');

  if (config.get('DATABASE_DRIVER', { infer: true }) === 'pglite') {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');

    const client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    logger.log('PGlite in-memory database ready (migrations applied)');

    return { db: db as unknown as Database, close: () => client.close() };
  }

  const pool = new Pool({
    connectionString: config.get('DATABASE_URL', { infer: true }),
    max: config.get('DATABASE_POOL_MAX', { infer: true }),
    ssl: config.get('DATABASE_SSL', { infer: true })
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const db = drizzlePg(pool, { schema });
  logger.log('PostgreSQL pool created');

  return { db, close: () => pool.end() };
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_HANDLE,
      inject: [ConfigService],
      useFactory: createHandle,
    },
    {
      provide: DRIZZLE,
      inject: [DATABASE_HANDLE],
      useFactory: (handle: DatabaseHandle) => handle.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}

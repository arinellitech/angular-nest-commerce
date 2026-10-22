import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DRIZZLE, type Database } from '../../src/database/database.module.js';

/**
 * Boots the real application on an in-memory PGlite database with all
 * migrations applied. Each test file gets its own isolated database.
 * Environment (DATABASE_DRIVER=pglite etc.) comes from vitest.config.e2e.ts.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  db: Database;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, db: app.get<Database>(DRIZZLE) };
}

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';
import { DRIZZLE, type Database } from '../../src/database/database.module.js';
import { Mailer } from '../../src/mail/mailer.js';
import { SearchClient } from '../../src/search/search-client.js';
import { InMemoryMailer } from './in-memory.mailer.js';
import { InMemorySearchClient } from './in-memory-search.client.js';

/**
 * Boots the real application on an in-memory PGlite database with all
 * migrations applied. Each test file gets its own isolated database, its
 * own in-memory search index (no Meilisearch needed) and an in-memory outbox
 * instead of SMTP.
 * Environment (DATABASE_DRIVER=pglite etc.) comes from vitest.config.e2e.ts.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  db: Database;
  search: InMemorySearchClient;
  mailer: InMemoryMailer;
  /** Rebuilds the search index from the database, like `npm run search:reindex`. */
  reindex: () => Promise<number>;
}> {
  const search = new InMemorySearchClient();
  const mailer = new InMemoryMailer();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SearchClient)
    .useValue(search)
    .overrideProvider(Mailer)
    .useValue(mailer)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const catalog = app.get(CatalogService);
  return {
    app,
    db: app.get<Database>(DRIZZLE),
    search,
    mailer,
    reindex: () => catalog.reindexSearch(),
  };
}

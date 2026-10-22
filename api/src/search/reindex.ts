/**
 * Rebuilds the `products` index from Postgres (published + active products).
 * Safe to run any time: the index keeps serving while it is rebuilt.
 * Usage: npm run search:reindex
 */
import { loadEnv, reindexCatalog, withDatabase } from './search.cli.js';

const env = loadEnv();
const indexed = await withDatabase(env, (db) => reindexCatalog(db, env));
console.log(`Search index rebuilt: ${indexed} products.`);

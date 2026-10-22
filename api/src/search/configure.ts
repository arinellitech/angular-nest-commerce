/**
 * Creates the `products` index (if missing) and applies its settings:
 * searchable/filterable/sortable attributes, ranking rules, typo tolerance.
 * Usage: npm run search:configure
 */
import { PRODUCTS_INDEX } from './meilisearch.client.js';
import { createSearchService, loadEnv } from './search.cli.js';

const env = loadEnv();
await createSearchService(env).configure();
console.log(
  `Search index "${PRODUCTS_INDEX}" configured on ${env.MEILISEARCH_HOST}.`,
);

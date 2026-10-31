import { and, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { products } from '../database/schema.js';

/** Products visible on the storefront (and therefore purchasable). */
export const publishedWhere = and(
  eq(products.isActive, true),
  isNotNull(products.publishedAt),
  lte(products.publishedAt, sql`now()`),
  isNull(products.deletedAt),
);

import { and, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { products, type Product } from '../database/schema.js';

/** Products visible on the storefront (and therefore purchasable). */
export const publishedWhere = and(
  eq(products.isActive, true),
  isNotNull(products.publishedAt),
  lte(products.publishedAt, sql`now()`),
  isNull(products.deletedAt),
);

/** In-memory twin of `publishedWhere`, for rows already loaded. */
export function isPublished(
  product: Pick<Product, 'isActive' | 'deletedAt' | 'publishedAt'>,
  at: Date = new Date(),
): boolean {
  return (
    product.isActive &&
    product.deletedAt === null &&
    product.publishedAt !== null &&
    product.publishedAt <= at
  );
}

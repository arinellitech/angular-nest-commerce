import { availableQuantity } from '../catalog/catalog.mappers.js';
import type { Category, Inventory, Product } from '../database/schema.js';
import type { ProductDocument } from './search-client.js';

export type IndexableProduct = Product & {
  category: Category | null;
  inventory: Inventory | null;
};

/** Same rule as CatalogService.publishedWhere, evaluated in memory. */
export function isPublished(product: Product, now: Date): boolean {
  return (
    product.isActive &&
    product.deletedAt === null &&
    product.publishedAt !== null &&
    product.publishedAt <= now
  );
}

export function toProductDocument(
  product: IndexableProduct,
  now: Date = new Date(),
): ProductDocument {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category
      ? { slug: product.category.slug, name: product.category.name }
      : null,
    price_cents: product.priceCents,
    in_stock: availableQuantity(product.inventory) > 0,
    published: isPublished(product, now),
    published_at: product.publishedAt
      ? Math.floor(product.publishedAt.getTime() / 1000)
      : 0,
    specs: Object.entries(product.specs ?? {}).map(
      ([key, value]) => `${key}: ${value}`,
    ),
  };
}

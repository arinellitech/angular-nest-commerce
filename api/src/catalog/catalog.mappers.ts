import { toMoney, type Money } from '../common/money.js';
import type {
  Category,
  Inventory,
  Product,
  ProductImage,
} from '../database/schema.js';

/** Resource shapes — mirror storefront/src/app/core/api/types.ts and docs/api.md. */

export interface CategoryResource {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  products_count?: number;
  children?: CategoryResource[];
}

export interface ProductImageResource {
  id: number;
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductResource {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: Money;
  compare_at_price?: Money;
  specs: Record<string, string>;
  in_stock: boolean | null;
  available_quantity: number | null;
  category?: CategoryResource;
  images?: ProductImageResource[];
  published_at: string | null;
}

/** `meta.facets` of GET /products when `search` is present. */
export interface ProductFacetsResource {
  categories: { slug: string; name: string; count: number }[];
  price: { min: Money; max: Money } | null;
}

export type ProductWithRelations = Product & {
  category?: Category | null;
  images?: ProductImage[];
  inventory?: Inventory | null;
};

export type CategoryWithRelations = Category & {
  children?: Category[];
  productsCount?: number;
};

export function imageUrl(image: ProductImage): string {
  // Absolute URLs (seeded placeholders, CDN, Supabase Storage public bucket) are returned as-is.
  if (image.path.startsWith('http')) return image.path;
  return `/storage/${image.path}`;
}

export function toCategoryResource(
  category: CategoryWithRelations,
): CategoryResource {
  const resource: CategoryResource = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    position: category.position,
  };
  if (category.productsCount !== undefined)
    resource.products_count = category.productsCount;
  if (category.children)
    resource.children = category.children.map((c) => toCategoryResource(c));
  return resource;
}

export function toFacetsResource(
  facets: {
    categories: Record<string, number>;
    price: { min: number; max: number } | null;
  },
  categoryNames: Map<string, string>,
  currency: string,
): ProductFacetsResource {
  return {
    categories: Object.entries(facets.categories)
      .filter(([slug, count]) => count > 0 && categoryNames.has(slug))
      .map(([slug, count]) => ({ slug, name: categoryNames.get(slug)!, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    price: facets.price
      ? {
          min: toMoney(facets.price.min, currency),
          max: toMoney(facets.price.max, currency),
        }
      : null,
  };
}

export function availableQuantity(
  inventory: Inventory | null | undefined,
): number {
  return inventory ? Math.max(0, inventory.quantity - inventory.reserved) : 0;
}

export function toProductResource(
  product: ProductWithRelations,
): ProductResource {
  const resource: ProductResource = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    price: toMoney(product.priceCents, product.currency),
    specs: product.specs ?? {},
    in_stock:
      product.inventory === undefined
        ? null
        : availableQuantity(product.inventory) > 0,
    available_quantity:
      product.inventory === undefined
        ? null
        : availableQuantity(product.inventory),
    published_at: product.publishedAt?.toISOString() ?? null,
  };

  if (
    product.compareAtPriceCents !== null &&
    product.compareAtPriceCents !== undefined
  ) {
    resource.compare_at_price = toMoney(
      product.compareAtPriceCents,
      product.currency,
    );
  }
  if (product.category)
    resource.category = toCategoryResource(product.category);
  if (product.images) {
    resource.images = product.images.map((image) => ({
      id: image.id,
      url: imageUrl(image),
      alt: image.alt,
      position: image.position,
    }));
  }
  return resource;
}

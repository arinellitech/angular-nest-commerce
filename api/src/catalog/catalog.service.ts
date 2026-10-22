import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { paginate, type Paginated } from '../common/pagination.js';
import { DRIZZLE, type Database } from '../database/database.module.js';
import { categories, inventory, products } from '../database/schema.js';
import {
  toCategoryResource,
  toProductResource,
  type CategoryResource,
  type ProductResource,
} from './catalog.mappers.js';
import type { ProductQueryDto } from './dto/product-query.dto.js';

/**
 * Database-backed catalog. PROMPT 01 swaps the `search` branch for
 * Meilisearch while keeping these signatures, so controllers and tests
 * don't change.
 */
@Injectable()
export class CatalogService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Products visible on the storefront. */
  private readonly publishedWhere = and(
    eq(products.isActive, true),
    isNotNull(products.publishedAt),
    lte(products.publishedAt, sql`now()`),
    isNull(products.deletedAt),
  );

  async listCategories(): Promise<CategoryResource[]> {
    const roots = await this.db.query.categories.findMany({
      where: and(eq(categories.isActive, true), isNull(categories.parentId)),
      orderBy: [asc(categories.position)],
      with: {
        children: {
          where: eq(categories.isActive, true),
          orderBy: [asc(categories.position)],
        },
      },
    });

    const counts = await this.productCountsByCategory();
    return roots.map((root) =>
      toCategoryResource({
        ...root,
        productsCount: counts.get(root.id) ?? 0,
        children: root.children.map((c) => ({
          ...c,
          productsCount: counts.get(c.id) ?? 0,
        })),
      }),
    );
  }

  async getCategory(slug: string): Promise<CategoryResource> {
    const category = await this.db.query.categories.findFirst({
      where: and(eq(categories.slug, slug), eq(categories.isActive, true)),
      with: {
        children: {
          where: eq(categories.isActive, true),
          orderBy: [asc(categories.position)],
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found.');

    const counts = await this.productCountsByCategory();
    return toCategoryResource({
      ...category,
      productsCount: counts.get(category.id) ?? 0,
      children: category.children.map((c) => ({
        ...c,
        productsCount: counts.get(c.id) ?? 0,
      })),
    });
  }

  async searchProducts(
    query: ProductQueryDto,
    baseUrl: string,
  ): Promise<Paginated<ProductResource>> {
    const conditions = [this.publishedWhere];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(products.sku, term),
          ilike(products.description, term),
        )!,
      );
    }

    if (query.category) {
      conditions.push(
        inArray(
          products.categoryId,
          this.db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.slug, query.category)),
        ),
      );
    }

    if (query.min_price !== undefined)
      conditions.push(gte(products.priceCents, query.min_price));
    if (query.max_price !== undefined)
      conditions.push(lte(products.priceCents, query.max_price));

    if (query.in_stock) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(inventory)
            .where(
              and(
                eq(inventory.productId, products.id),
                gt(inventory.quantity, inventory.reserved),
              ),
            ),
        ),
      );
    }

    const where = and(...conditions);
    const orderBy = {
      price_asc: [asc(products.priceCents), asc(products.id)],
      price_desc: [desc(products.priceCents), asc(products.id)],
      name: [asc(products.name), asc(products.id)],
      newest: [desc(products.publishedAt), desc(products.id)],
    }[query.sort];

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(products)
      .where(where);

    const rows = await this.db.query.products.findMany({
      where,
      orderBy,
      limit: query.per_page,
      offset: (query.page - 1) * query.per_page,
      with: {
        category: true,
        images: { orderBy: [asc(sql`position`)] },
        inventory: true,
      },
    });

    return paginate(rows.map(toProductResource), {
      page: query.page,
      perPage: query.per_page,
      total: Number(total),
      baseUrl,
      query: {
        search: query.search,
        category: query.category,
        min_price: query.min_price,
        max_price: query.max_price,
        in_stock: query.in_stock,
        sort: query.sort,
        per_page: query.per_page,
      },
    });
  }

  async getProduct(slug: string): Promise<ProductResource> {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.slug, slug), this.publishedWhere),
      with: {
        category: true,
        images: { orderBy: [asc(sql`position`)] },
        inventory: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return toProductResource(product);
  }

  private async productCountsByCategory(): Promise<Map<number, number>> {
    const rows = await this.db
      .select({ categoryId: products.categoryId, total: count() })
      .from(products)
      .where(this.publishedWhere)
      .groupBy(products.categoryId);
    return new Map(
      rows
        .filter((r) => r.categoryId !== null)
        .map((r) => [r.categoryId!, Number(r.total)]),
    );
  }
}

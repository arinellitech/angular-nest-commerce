import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  type SQL,
} from 'drizzle-orm';
import { paginate, type Paginated } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { DRIZZLE, type Database } from '../database/database.module.js';
import { categories, inventory, products } from '../database/schema.js';
import type { ProductSearchResult } from '../search/search-client.js';
import { SearchService } from '../search/search.service.js';
import {
  toCategoryResource,
  toFacetsResource,
  toProductResource,
  type CategoryResource,
  type ProductFacetsResource,
  type ProductResource,
} from './catalog.mappers.js';
import { rollUpCounts, withDescendants } from './category-tree.js';
import { resolveSort, type ProductQueryDto } from './dto/product-query.dto.js';

export type ProductPage = Paginated<ProductResource> & {
  meta: { facets?: ProductFacetsResource };
};

type ActiveCategory = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
};

/**
 * Catalog reads. With `search`, GET /products asks the search engine for ids
 * (typo tolerance, relevance, facets) and hydrates them from Postgres, which
 * stays the source of truth for price, stock and visibility. Without `search`
 * (or when the engine is down) it is a plain SQL query.
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly search: SearchService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Products visible on the storefront. */
  private readonly publishedWhere = and(
    eq(products.isActive, true),
    isNotNull(products.publishedAt),
    lte(products.publishedAt, sql`now()`),
    isNull(products.deletedAt),
  );

  private readonly productRelations = {
    category: true as const,
    images: { orderBy: [asc(sql`position`)] },
    inventory: true as const,
  };

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
  ): Promise<ProductPage> {
    // Categories resolve the category filter (with descendants) and name the facets.
    const activeCategories =
      query.search || query.category ? await this.activeCategories() : [];
    // undefined = no category filter; [] = unknown category (no results).
    const scope = query.category
      ? this.categoryScope(activeCategories, query.category)
      : undefined;

    if (query.search) {
      const result = await this.queryEngine(query, query.search, scope);
      if (result) return this.hydrate(query, result, activeCategories, baseUrl);
    }
    return this.searchWithSql(query, scope, baseUrl);
  }

  async getProduct(slug: string): Promise<ProductResource> {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.slug, slug), this.publishedWhere),
      with: this.productRelations,
    });
    if (!product) throw new NotFoundException('Product not found.');
    return toProductResource(product);
  }

  /**
   * Search index hook: every catalog write must call it (admin in PROMPT 06,
   * stock changes in PROMPT 03). Published products are upserted, anything
   * else is removed from the index. Until a write is synced, hydration keeps
   * responses correct (stale hits are dropped), only counts may lag.
   */
  async syncSearchIndex(productIds: number[]): Promise<void> {
    if (productIds.length === 0) return;
    const rows = await this.db.query.products.findMany({
      where: and(inArray(products.id, productIds), this.publishedWhere),
      with: { category: true, inventory: true },
    });
    const published = new Set(rows.map((r) => r.id));
    await this.search.upsert(rows);
    await this.search.remove(productIds.filter((id) => !published.has(id)));
  }

  /** Full rebuild (seed, `npm run search:reindex`). Returns the number of indexed products. */
  async reindexSearch(): Promise<number> {
    const rows = await this.db.query.products.findMany({
      where: this.publishedWhere,
      with: { category: true, inventory: true },
    });
    await this.search.reindex(rows);
    return rows.length;
  }

  /** Engine hits, or undefined when the engine is unreachable (the caller falls back to SQL). */
  private async queryEngine(
    query: ProductQueryDto,
    term: string,
    scope: ActiveCategory[] | undefined,
  ): Promise<ProductSearchResult | undefined> {
    if (scope?.length === 0)
      return { ids: [], total: 0, facets: { categories: {}, price: null } };
    try {
      return await this.search.search({
        query: term,
        filters: {
          categorySlugs: scope?.map((c) => c.slug),
          minPriceCents: query.min_price,
          maxPriceCents: query.max_price,
          inStock: query.in_stock,
        },
        sort: resolveSort(query),
        page: query.page,
        perPage: query.per_page,
      });
    } catch (error) {
      this.logger.warn(
        `Search engine unavailable, falling back to SQL: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private async hydrate(
    query: ProductQueryDto,
    result: ProductSearchResult,
    activeCategories: ActiveCategory[],
    baseUrl: string,
  ): Promise<ProductPage> {
    // Postgres decides what is shown: hits made stale since the last index
    // sync (unpublished, repriced, sold out) fail these filters and are dropped.
    const rows =
      result.ids.length === 0
        ? []
        : await this.db.query.products.findMany({
            where: and(
              inArray(products.id, result.ids),
              ...this.filterConditions(query),
            ),
            with: this.productRelations,
          });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = result.ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toProductResource(row)] : [];
    });
    const dropped = result.ids.length - ordered.length;

    const page = this.paginate(
      ordered,
      Math.max(0, result.total - dropped),
      query,
      baseUrl,
    );
    return {
      ...page,
      meta: {
        ...page.meta,
        facets: toFacetsResource(
          result.facets,
          new Map(activeCategories.map((c) => [c.slug, c.name])),
          this.config.get('COMMERCE_CURRENCY', { infer: true }),
        ),
      },
    };
  }

  private async searchWithSql(
    query: ProductQueryDto,
    scope: ActiveCategory[] | undefined,
    baseUrl: string,
  ): Promise<ProductPage> {
    const conditions: (SQL | undefined)[] = this.filterConditions(query);

    // Only reached without a search engine: no typo tolerance, no facets.
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(products.sku, term),
          ilike(products.description, term),
        ),
      );
    }

    if (scope) {
      conditions.push(
        inArray(
          products.categoryId,
          scope.map((c) => c.id),
        ),
      );
    }

    const where = and(...conditions);
    const orderBy = {
      price_asc: [asc(products.priceCents), asc(products.id)],
      price_desc: [desc(products.priceCents), asc(products.id)],
      name: [asc(products.name), asc(products.id)],
      newest: [desc(products.publishedAt), desc(products.id)],
      relevance: [desc(products.publishedAt), desc(products.id)],
    }[resolveSort(query)];

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(products)
      .where(where);

    const rows = await this.db.query.products.findMany({
      where,
      orderBy,
      limit: query.per_page,
      offset: (query.page - 1) * query.per_page,
      with: this.productRelations,
    });

    return this.paginate(
      rows.map(toProductResource),
      Number(total),
      query,
      baseUrl,
    );
  }

  /** Visibility, price and stock: shared by the SQL listing and the hydration of search hits. */
  private filterConditions(query: ProductQueryDto): (SQL | undefined)[] {
    const conditions: (SQL | undefined)[] = [this.publishedWhere];
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
    return conditions;
  }

  private paginate(
    data: ProductResource[],
    total: number,
    query: ProductQueryDto,
    baseUrl: string,
  ): Paginated<ProductResource> {
    return paginate(data, {
      page: query.page,
      perPage: query.per_page,
      total,
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

  private activeCategories(): Promise<ActiveCategory[]> {
    return this.db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.isActive, true));
  }

  private categoryScope(
    activeCategories: ActiveCategory[],
    slug: string,
  ): ActiveCategory[] {
    const root = activeCategories.find((c) => c.slug === slug);
    return root ? withDescendants(activeCategories, root.id) : [];
  }

  /** Published products per category, including subcategories. */
  private async productCountsByCategory(): Promise<Map<number, number>> {
    const rows = await this.db
      .select({ categoryId: products.categoryId, total: count() })
      .from(products)
      .where(this.publishedWhere)
      .groupBy(products.categoryId);
    const direct = new Map(
      rows
        .filter((r) => r.categoryId !== null)
        .map((r) => [r.categoryId!, Number(r.total)]),
    );
    return rollUpCounts(await this.activeCategories(), direct);
  }
}

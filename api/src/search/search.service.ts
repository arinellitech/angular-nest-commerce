import { Injectable } from '@nestjs/common';
import { toProductDocument, type IndexableProduct } from './product-document.js';
import {
  SearchClient,
  type ProductSearchRequest,
  type ProductSearchResult,
} from './search-client.js';

/**
 * Product search on top of the engine port. Knows how a product becomes a
 * document; knows nothing about HTTP or the database (CatalogService loads
 * the rows and hydrates the hits).
 */
@Injectable()
export class SearchService {
  constructor(private readonly client: SearchClient) {}

  configure(): Promise<void> {
    return this.client.configure();
  }

  /** Full rebuild: settings + exactly these products. */
  async reindex(products: IndexableProduct[]): Promise<void> {
    await this.client.configure();
    await this.client.replaceAll(products.map((p) => toProductDocument(p)));
  }

  async upsert(products: IndexableProduct[]): Promise<void> {
    if (products.length === 0) return;
    await this.client.upsert(products.map((p) => toProductDocument(p)));
  }

  async remove(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.client.remove(ids);
  }

  search(request: ProductSearchRequest): Promise<ProductSearchResult> {
    return this.client.search(request);
  }
}

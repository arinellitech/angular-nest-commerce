import { availableQuantity } from '../catalog/catalog.mappers.js';
import { isPublished } from '../catalog/published.js';
import type { Inventory, Product } from '../database/schema.js';

export interface CheckoutLineInput {
  productId: number;
  quantity: number;
  /** Price snapshot stored in the cart line. */
  unitPriceCents: number;
}

export const LineProblemReason = {
  Unavailable: 'unavailable',
  InsufficientStock: 'insufficient_stock',
} as const;
export type LineProblemReason =
  (typeof LineProblemReason)[keyof typeof LineProblemReason];

export interface LineProblem {
  productId: number;
  name: string;
  requested: number;
  available: number;
  reason: LineProblemReason;
}

export interface ReviewedLine {
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  /** Live price: what the order charges. */
  unitPriceCents: number;
  /** The cart snapshot differed from the live price (the snapshot gets refreshed). */
  priceChanged: boolean;
}

/**
 * Re-validates every cart line against the live catalog and the (locked)
 * inventory rows: the product must still be published, `quantity - reserved`
 * must cover the line, and the price is taken from the product, not from the
 * snapshot. Returns every problem at once so the customer can fix the cart in
 * one go.
 */
export function reviewCartLines(
  lines: readonly CheckoutLineInput[],
  products: ReadonlyMap<number, Product>,
  stock: ReadonlyMap<number, Inventory>,
  at: Date = new Date(),
): { lines: ReviewedLine[]; problems: LineProblem[] } {
  const reviewed: ReviewedLine[] = [];
  const problems: LineProblem[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || !isPublished(product, at)) {
      problems.push({
        productId: line.productId,
        name: product?.name ?? `Produto #${line.productId}`,
        requested: line.quantity,
        available: 0,
        reason: LineProblemReason.Unavailable,
      });
      continue;
    }

    const available = availableQuantity(stock.get(product.id));
    if (line.quantity > available) {
      problems.push({
        productId: product.id,
        name: product.name,
        requested: line.quantity,
        available,
        reason: LineProblemReason.InsufficientStock,
      });
      continue;
    }

    reviewed.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
      priceChanged: product.priceCents !== line.unitPriceCents,
    });
  }

  return { lines: reviewed, problems };
}

/** pt-BR sentence shown next to the cart line. */
export function describeLineProblem(problem: LineProblem): string {
  if (problem.reason === LineProblemReason.Unavailable)
    return `${problem.name} não está mais disponível.`;
  if (problem.available === 0) return `${problem.name} está esgotado.`;
  if (problem.available === 1)
    return `${problem.name}: apenas 1 unidade disponível.`;
  return `${problem.name}: apenas ${problem.available} unidades disponíveis.`;
}

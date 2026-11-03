/**
 * `stock_movements.type`. `quantity` is the signed change applied to the
 * counter the movement touches:
 * - received / adjusted / sold → `inventory.quantity` (sold is negative)
 * - reserved / released        → `inventory.reserved` (reserved is positive,
 *   released negative)
 */
export const StockMovementType = {
  Received: 'received',
  Reserved: 'reserved',
  Released: 'released',
  Sold: 'sold',
  Adjusted: 'adjusted',
} as const;

export type StockMovementType =
  (typeof StockMovementType)[keyof typeof StockMovementType];

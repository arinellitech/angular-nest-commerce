export const OrderStatus = {
  PendingPayment: 'pending_payment',
  Paid: 'paid',
  Fulfilled: 'fulfilled',
  Cancelled: 'cancelled',
  Refunded: 'refunded',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Allowed state transitions. Anything not listed here must throw. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: [OrderStatus.Paid, OrderStatus.Cancelled],
  paid: [OrderStatus.Fulfilled, OrderStatus.Refunded],
  fulfilled: [OrderStatus.Refunded],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly orderNumber: string,
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Order ${orderNumber} cannot go from ${from} to ${to}.`);
    this.name = 'InvalidOrderTransitionError';
  }
}

/**
 * The only way to change an order's status. Returns the patch to persist
 * (status + timestamp) so callers apply it inside their own transaction.
 */
export function transitionOrder(
  order: { number: string; status: string },
  to: OrderStatus,
  now: Date = new Date(),
): { status: OrderStatus; paidAt?: Date; cancelledAt?: Date } {
  const from = order.status as OrderStatus;
  if (!canTransition(from, to))
    throw new InvalidOrderTransitionError(order.number, from, to);

  switch (to) {
    case OrderStatus.Paid:
      return { status: to, paidAt: now };
    case OrderStatus.Cancelled:
      return { status: to, cancelledAt: now };
    default:
      return { status: to };
  }
}

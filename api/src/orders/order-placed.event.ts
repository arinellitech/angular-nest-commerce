export const ORDER_PLACED = 'order.placed';

/** Emitted once per order, when its payment has been created at the provider. */
export class OrderPlacedEvent {
  constructor(public readonly orderId: string) {}
}

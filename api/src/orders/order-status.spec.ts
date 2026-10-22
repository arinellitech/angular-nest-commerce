import {
  canTransition,
  InvalidOrderTransitionError,
  OrderStatus,
  transitionOrder,
} from './order-status.js';

describe('order status state machine', () => {
  it.each([
    [OrderStatus.PendingPayment, OrderStatus.Paid, true],
    [OrderStatus.PendingPayment, OrderStatus.Cancelled, true],
    [OrderStatus.PendingPayment, OrderStatus.Fulfilled, false],
    [OrderStatus.Paid, OrderStatus.Fulfilled, true],
    [OrderStatus.Paid, OrderStatus.Refunded, true],
    [OrderStatus.Paid, OrderStatus.PendingPayment, false],
    [OrderStatus.Cancelled, OrderStatus.Paid, false],
    [OrderStatus.Refunded, OrderStatus.Fulfilled, false],
  ])('%s → %s allowed=%s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it('returns the patch with timestamps', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    expect(
      transitionOrder(
        { number: 'ORD-1', status: 'pending_payment' },
        OrderStatus.Paid,
        now,
      ),
    ).toEqual({
      status: 'paid',
      paidAt: now,
    });
  });

  it('throws on invalid transitions', () => {
    expect(() =>
      transitionOrder(
        { number: 'ORD-1', status: 'cancelled' },
        OrderStatus.Paid,
      ),
    ).toThrow(InvalidOrderTransitionError);
  });
});

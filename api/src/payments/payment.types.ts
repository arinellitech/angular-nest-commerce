export const PaymentMethod = {
  Pix: 'pix',
  Card: 'card',
  Boleto: 'boleto',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Failed: 'failed',
  Refunded: 'refunded',
  Expired: 'expired',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return status !== PaymentStatus.Pending;
}

/** Normalized result of a provider webhook, independent of the provider's payload. */
export interface WebhookResult {
  externalId: string; // provider's event id (idempotency key)
  type: string; // provider event type, e.g. PAYMENT_CONFIRMED
  providerReference: string; // provider's charge/payment id
  status: PaymentStatus;
  payload: Record<string, unknown>;
}

/** What `charge()` returns: enough for the storefront to render the payment step. */
export interface ChargeResult {
  provider: string;
  method: PaymentMethod;
  providerReference: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  expiresAt: Date | null;
  payload: Record<string, unknown>;
}

import type { INestApplication } from '@nestjs/common';
import type { Request } from 'express';
import { createTestApp } from './helpers/app.js';
import { PaymentGateway } from '../src/payments/payment-gateway.js';
import { PaymentMethod } from '../src/payments/payment.types.js';
import type { Order } from '../src/database/schema.js';

const fakeOrder = {
  number: 'ORD-2026-000001',
  totalCents: 12345,
  currency: 'BRL',
} as Order;

function fakeRequest(headers: Record<string, string>, body: unknown): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
    body,
  } as unknown as Request;
}

describe('payments module', () => {
  let app: INestApplication;
  let gateway: PaymentGateway;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    gateway = app.get(PaymentGateway);
  });

  afterAll(() => app.close());

  it('resolves the mock gateway from PAYMENT_PROVIDER', () => {
    expect(gateway.name).toBe('mock');
  });

  it('creates a pending Pix charge with copy-paste payload and expiry', async () => {
    const charge = await gateway.charge(fakeOrder, PaymentMethod.Pix);
    expect(charge.providerReference).toMatch(/^mock_/);
    expect(charge.pixCopyPaste).toContain('br.gov.bcb.pix');
    expect(charge.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects webhooks with a bad secret', async () => {
    await expect(
      gateway.parseWebhook(
        fakeRequest(
          { 'x-webhook-secret': 'wrong' },
          { id: 'evt_1', type: 'payment.confirmed', reference: 'mock_1' },
        ),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('normalizes a valid webhook', async () => {
    const result = await gateway.parseWebhook(
      fakeRequest(
        { 'x-webhook-secret': 'test-webhook-secret' },
        { id: 'evt_1', type: 'payment.confirmed', reference: 'mock_1' },
      ),
    );
    expect(result).toMatchObject({
      externalId: 'evt_1',
      providerReference: 'mock_1',
      status: 'confirmed',
    });
  });
});

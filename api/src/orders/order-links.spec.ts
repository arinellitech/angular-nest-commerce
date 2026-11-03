import { signOrderToken, verifyOrderToken } from './order-links.js';

const secret = 'a'.repeat(32);
const orderId = '0b6f0e1e-6c2a-4c55-9b7e-2f1d8a4b9c10';

describe('order access tokens', () => {
  it('verifies a token signed for the same order', () => {
    const token = signOrderToken(secret, orderId);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(verifyOrderToken(secret, orderId, token)).toBe(true);
  });

  it('rejects another order, another secret, tampering and garbage', () => {
    const token = signOrderToken(secret, orderId);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyOrderToken(secret, crypto.randomUUID(), token)).toBe(false);
    expect(verifyOrderToken('b'.repeat(32), orderId, token)).toBe(false);
    expect(verifyOrderToken(secret, orderId, tampered)).toBe(false);
    expect(verifyOrderToken(secret, orderId, '')).toBe(false);
    expect(verifyOrderToken(secret, orderId, 'é')).toBe(false);
  });
});

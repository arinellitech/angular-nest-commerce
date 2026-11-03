import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import type { Payment } from '../../core/api/types';
import { PixPayment, formatRemaining } from './pix-payment';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p-1',
    provider: 'mock',
    method: 'pix',
    status: 'pending',
    amount: { amount: 9190, currency: 'BRL', formatted: 'R$ 91,90' },
    pix_copy_paste: '00020126580014br.gov.bcb.pix0136abc',
    pix_qr_code: null,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    confirmed_at: null,
    ...overrides,
  };
}

describe('formatRemaining', () => {
  it('formats minutes and seconds, hours when needed, never negative', () => {
    expect(formatRemaining(29 * 60_000 + 41_000)).toBe('29:41');
    expect(formatRemaining(65_000)).toBe('1:05');
    expect(formatRemaining(3_723_000)).toBe('1:02:03');
    expect(formatRemaining(-5_000)).toBe('0:00');
  });
});

describe('PixPayment', () => {
  async function render(value: Payment) {
    const fixture = TestBed.createComponent(PixPayment);
    fixture.componentRef.setInput('payment', value);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the QR code, the amount, the code and the time left', async () => {
    const { el } = await render(payment());
    expect(el.querySelector('svg[aria-label="QR Code do Pix"]')).not.toBeNull();
    expect(el.textContent).toContain('R$ 91,90');
    expect((el.querySelector('#pix-code') as HTMLInputElement).value).toContain('br.gov.bcb.pix');
    expect(el.textContent).toMatch(/Expira em\s+(29:5\d|30:00)/);
  });

  it('copies the code and confirms it', async () => {
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const { fixture, el } = await render(payment());

    const button = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Copiar código'),
    )!;
    button.click();
    await fixture.whenStable();

    expect(copy).toHaveBeenCalledWith('00020126580014br.gov.bcb.pix0136abc');
    expect(button.textContent).toContain('Copiado');
    expect(el.textContent).toContain('Código Pix copiado.');
  });

  it('replaces the QR code once the charge expired', async () => {
    const { el } = await render(payment({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).toContain('O código Pix expirou');
  });
});

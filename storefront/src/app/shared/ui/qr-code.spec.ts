import { TestBed } from '@angular/core/testing';
import { QrCode, qrPath } from './qr-code';

describe('qrPath', () => {
  it('draws one unit square per dark module, offset by the quiet zone', () => {
    const dark = new Set(['0,0', '1,1']);
    expect(qrPath(2, (r, c) => dark.has(`${r},${c}`))).toBe('M2 2h1v1h-1zM3 3h1v1h-1z');
  });
});

describe('QrCode', () => {
  it('renders a labelled SVG for a Pix payload', async () => {
    const fixture = TestBed.createComponent(QrCode);
    fixture.componentRef.setInput('value', '00020126580014br.gov.bcb.pix0136abc');
    fixture.componentRef.setInput('label', 'QR Code do Pix');
    await fixture.whenStable();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('QR Code do Pix');
    // Version 3+ symbol (29+ modules) plus a 2-module margin on each side.
    const side = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    expect(side).toBeGreaterThanOrEqual(29 + 4);
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

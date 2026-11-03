import { Component, computed, input } from '@angular/core';
import { create } from 'qrcode';

/** Quiet zone around the symbol, in modules (the spec asks for 4; 2 reads fine on a white card). */
const MARGIN = 2;

/**
 * SVG path for the dark modules: one `M x y h1 v1 h-1 z` square per module,
 * offset by the quiet zone. Pure, so it is easy to test.
 */
export function qrPath(size: number, isDark: (row: number, col: number) => boolean): string {
  const parts: string[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (isDark(row, col)) parts.push(`M${col + MARGIN} ${row + MARGIN}h1v1h-1z`);
  return parts.join('');
}

/**
 * QR code drawn as one SVG path (crisp at any size, colored with
 * `currentColor`, no canvas and no innerHTML). Encodes `value` as-is.
 */
@Component({
  selector: 'app-qr-code',
  host: { class: 'block' },
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      role="img"
      [attr.aria-label]="label()"
      shape-rendering="crispEdges"
      class="block size-full"
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path [attr.d]="path()" fill="currentColor" />
    </svg>
  `,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly label = input('QR Code');

  private readonly symbol = computed(
    () => create(this.value(), { errorCorrectionLevel: 'M' }).modules,
  );
  protected readonly viewBox = computed(() => {
    const side = this.symbol().size + MARGIN * 2;
    return `0 0 ${side} ${side}`;
  });
  protected readonly path = computed(() => {
    const modules = this.symbol();
    return qrPath(modules.size, (row, col) => modules.get(row, col) === 1);
  });
}

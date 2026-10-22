import { DOCUMENT, PLATFORM_ID, REQUEST, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const COOKIE = 'cart_token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Holds the guest cart token (issued by the API in the X-Cart-Token header).
 * Stored in a cookie so SSR requests can forward it too.
 */
@Service()
export class CartToken {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, { optional: true });

  readonly value = signal<string | null>(this.read());

  set(token: string | null): void {
    this.value.set(token);
    if (!this.isBrowser) return;
    this.document.cookie = token
      ? `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`
      : `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  private read(): string | null {
    const cookieHeader = this.isBrowser
      ? this.document.cookie
      : (this.request?.headers.get('cookie') ?? '');
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
}

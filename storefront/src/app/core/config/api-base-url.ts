import {
  InjectionToken,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { environment } from '../../../environments/environment';

/** Shape of the context object server.ts passes to `angularApp.handle(req, context)`. */
export interface ServerRequestContext {
  /** URL the SSR server uses to reach the API (may be a private network URL). */
  apiBaseUrl?: string;
  /** URL the browser uses to reach the API. */
  publicApiBaseUrl?: string;
}

const PUBLIC_API_BASE_URL_KEY = makeStateKey<string>('publicApiBaseUrl');

/**
 * Base URL of the commerce API.
 * - Server: from the request context (env vars read in server.ts), else environment.
 *   The public URL is handed to the browser through TransferState so one env var
 *   on the host configures both sides.
 * - Browser: from TransferState (hydrated SSR page), else environment.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    const transferState = inject(TransferState);

    if (isPlatformServer(inject(PLATFORM_ID))) {
      const context = inject<ServerRequestContext | null>(REQUEST_CONTEXT, { optional: true });
      const publicUrl = context?.publicApiBaseUrl ?? context?.apiBaseUrl ?? environment.apiBaseUrl;
      transferState.set(PUBLIC_API_BASE_URL_KEY, publicUrl);
      return context?.apiBaseUrl ?? publicUrl;
    }

    return transferState.get(PUBLIC_API_BASE_URL_KEY, environment.apiBaseUrl);
  },
});

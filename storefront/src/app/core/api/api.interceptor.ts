import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url';
import { CartToken } from './cart-token';

/**
 * - Prefixes relative `/api/...` URLs with the API base URL (so components and
 *   resources never hard-code a host).
 * - Attaches the guest cart token; persists a rotated token from the response.
 * - Auth bearer is added here in PROMPT 05.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  const cartToken = inject(CartToken);

  let request = req;
  if (req.url.startsWith('/api/')) {
    request = req.clone({
      url: `${baseUrl}${req.url}`,
      setHeaders: { Accept: 'application/json' },
    });
  }

  const token = cartToken.value();
  if (token && request.url.startsWith(baseUrl)) {
    request = request.clone({ setHeaders: { 'X-Cart-Token': token } });
  }

  return next(request).pipe(
    tap((event) => {
      if ('headers' in event && event.headers) {
        const issued = event.headers.get('X-Cart-Token');
        if (issued && issued !== cartToken.value()) cartToken.set(issued);
      }
    }),
  );
};

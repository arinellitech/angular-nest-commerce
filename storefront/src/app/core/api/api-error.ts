import { HttpErrorResponse } from '@angular/common/http';
import type { ApiValidationError } from './types';

/** An API failure reduced to what the UI needs. */
export interface ApiError {
  status: number;
  /** Text safe to show to the customer. */
  message: string;
  /** First message per field of a 422 (`errors[field][0]`). */
  errors: Record<string, string>;
  /** The API's own `message`, for logic (not for display). */
  detail: string | undefined;
}

export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      message: 'Algo deu errado. Tente novamente.',
      errors: {},
      detail: undefined,
    };
  }

  const body = (error.error ?? {}) as Partial<ApiValidationError>;
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(body.errors ?? {})) {
    if (messages[0]) errors[field] = messages[0];
  }

  const message =
    Object.values(errors)[0] ??
    (error.status === 0
      ? 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
      : 'Algo deu errado. Tente novamente.');

  return { status: error.status, message, errors, detail: body.message };
}

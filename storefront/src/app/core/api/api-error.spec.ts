import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('keeps the first message of each field of a 422', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 422,
        error: {
          message: 'Validation failed.',
          errors: { quantity: ['Apenas 3.', 'outra'], code: ['Inválido.'] },
        },
      }),
    );
    expect(error).toMatchObject({
      status: 422,
      errors: { quantity: 'Apenas 3.', code: 'Inválido.' },
      detail: 'Validation failed.',
    });
    expect(error.message).toBe('Apenas 3.');
  });

  it('explains a network failure in plain words', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.message).toContain('Sem conexão');
  });

  it('never shows the API text of a server error', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 500, error: { message: 'Internal server error.' } }),
    );
    expect(error.message).toBe('Algo deu errado. Tente novamente.');
    expect(error.detail).toBe('Internal server error.');
  });
});

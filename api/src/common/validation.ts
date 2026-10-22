import {
  UnprocessableEntityException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

/**
 * Flattens class-validator errors into `{ message, errors: { field: [...] } }`
 * with HTTP 422 — the shape the storefront maps onto form fields.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) out[path] = Object.values(error.constraints);
    if (error.children?.length)
      Object.assign(out, flattenValidationErrors(error.children, path));
  }
  return out;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors) =>
      new UnprocessableEntityException({
        message: 'Validation failed.',
        errors: flattenValidationErrors(errors),
      }),
  });
}

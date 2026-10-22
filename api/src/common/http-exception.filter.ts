import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Normalizes every error to `{ message, errors? }` and never leaks stack
 * traces. Validation errors already carry `errors`; everything else is a
 * single message.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string'
          ? { message: body }
          : {
              message:
                (body as { message?: unknown }).message ?? exception.message,
              ...(body as object),
            };
      response.status(status).json(payload);
      return;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: 'Internal server error.' });
  }
}

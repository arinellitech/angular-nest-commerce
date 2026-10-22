import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { createValidationPipe } from './common/validation.js';
import type { Env } from './config/env.js';

/**
 * Everything that must be identical between `main.ts` and the e2e test app:
 * prefix + versioning (/api/v1/...), validation, error shape, CORS, docs.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const origins = config
    .get('CORS_ALLOWED_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: [...origins, /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.vercel\.app$/], // + Vercel preview deployments
    credentials: true,
    exposedHeaders: ['X-Cart-Token', 'X-Request-Id'],
  });

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Commerce API')
        .setDescription(
          'Headless commerce API consumed by the Angular storefront. Money is integer cents.',
        )
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}

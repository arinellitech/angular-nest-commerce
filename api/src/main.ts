import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // behind Fly/Railway/Vercel proxies
  configureApp(app);

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API listening on http://localhost:${port}/api/v1 — docs at /api/docs`,
  );
}

await bootstrap();

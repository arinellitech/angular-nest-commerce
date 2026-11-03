import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    PaymentsModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    // WebhooksModule  → PROMPT 04
    // AuthModule      → PROMPT 05
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

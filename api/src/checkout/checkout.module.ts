import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [OrdersModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}

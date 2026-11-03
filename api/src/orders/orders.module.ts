import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { OrderLinks } from './order-links.js';
import { OrderPlacedListener } from './order-placed.listener.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [MailModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderLinks, OrderPlacedListener],
  exports: [OrdersService],
})
export class OrdersModule {}

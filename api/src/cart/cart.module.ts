import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CartGuard } from './cart.guard.js';
import { CartService } from './cart.service.js';

@Module({
  controllers: [CartController],
  providers: [CartService, CartGuard],
  exports: [CartService],
})
export class CartModule {}

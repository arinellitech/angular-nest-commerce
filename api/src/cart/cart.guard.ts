import {
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Cart } from '../database/schema.js';
import { CartService } from './cart.service.js';

export type CartRequest = Request & { cart: Cart };

/**
 * Resolves the caller's active cart from `X-Cart-Token` (404 when missing,
 * unknown, expired or converted) and renews its expiry. Handlers read it with
 * `@CurrentCart()`. PROMPT 05 extends the lookup to authenticated users.
 */
@Injectable()
export class CartGuard implements CanActivate {
  constructor(private readonly carts: CartService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CartRequest>();
    request.cart = await this.carts.resolveByToken(
      request.header('x-cart-token'),
    );
    return true;
  }
}

export const CurrentCart = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Cart =>
    context.switchToHttp().getRequest<CartRequest>().cart,
);

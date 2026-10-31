import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Cart } from '../database/schema.js';
import { CartGuard, CurrentCart } from './cart.guard.js';
import { CartService } from './cart.service.js';
import {
  AddCartItemDto,
  ApplyCouponDto,
  UpdateCartItemDto,
} from './dto/cart.dto.js';

/** A non-numeric item id can never match a line: 404, like any unknown id. */
const itemId = new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post()
  @ApiCreatedResponse({
    description:
      'New guest cart. The token is returned in the `X-Cart-Token` header and in `data.token`.',
  })
  async create(@Res({ passthrough: true }) response: Response) {
    const cart = await this.cart.create();
    response.setHeader('X-Cart-Token', cart.token);
    return { data: cart };
  }

  @Get()
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiOkResponse({ description: 'The cart with items and totals.' })
  @ApiNotFoundResponse({ description: 'Unknown or expired cart token.' })
  async show(@CurrentCart() cart: Cart) {
    return { data: await this.cart.show(cart.id) };
  }

  @Post('items')
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiCreatedResponse({
    description: 'Cart after adding (or incrementing) the item.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Unavailable product (`errors.product_id`) or not enough stock (`errors.quantity`).',
  })
  async addItem(@CurrentCart() cart: Cart, @Body() dto: AddCartItemDto) {
    return { data: await this.cart.addItem(cart.id, dto) };
  }

  @Patch('items/:id')
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiOkResponse({ description: 'Cart after changing the quantity.' })
  @ApiUnprocessableEntityResponse({
    description: 'Not enough stock (`errors.quantity`).',
  })
  async updateItem(
    @CurrentCart() cart: Cart,
    @Param('id', itemId) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return { data: await this.cart.updateQuantity(cart.id, id, dto.quantity) };
  }

  @Delete('items/:id')
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiOkResponse({ description: 'Cart after removing the item.' })
  async removeItem(@CurrentCart() cart: Cart, @Param('id', itemId) id: number) {
    return { data: await this.cart.removeItem(cart.id, id) };
  }

  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiOkResponse({ description: 'Cart with the coupon applied.' })
  @ApiUnprocessableEntityResponse({
    description:
      'Unknown, inactive, expired, exhausted or below-minimum coupon (`errors.code`).',
  })
  async applyCoupon(@CurrentCart() cart: Cart, @Body() dto: ApplyCouponDto) {
    return { data: await this.cart.applyCoupon(cart.id, dto.code) };
  }

  @Delete('coupon')
  @UseGuards(CartGuard)
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiOkResponse({ description: 'Cart without a coupon.' })
  async removeCoupon(@CurrentCart() cart: Cart) {
    return { data: await this.cart.removeCoupon(cart.id) };
  }
}

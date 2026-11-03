import { Controller, Get, Header, Headers, Param, Query } from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderAccessQueryDto } from './dto/order-access.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':number')
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({
    name: 'X-Cart-Token',
    required: false,
    description: 'Token of the cart the order was placed from.',
  })
  @ApiOkResponse({ description: 'The order with items, totals and payment.' })
  @ApiNotFoundResponse({
    description:
      'Unknown order, or neither a matching cart token nor a valid `token`.',
  })
  async show(
    @Param('number') number: string,
    @Query() query: OrderAccessQueryDto,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return {
      data: await this.orders.findAccessible(number, {
        cartToken,
        accessToken: query.token,
      }),
    };
  }
}

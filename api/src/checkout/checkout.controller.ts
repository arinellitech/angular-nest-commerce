import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CheckoutService } from './checkout.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { IdempotencyKey } from './idempotency-key.decorator.js';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'UUID generated once per checkout attempt; resend it on retries.',
  })
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiCreatedResponse({
    description: 'Order placed: stock reserved, Pix charge created.',
  })
  @ApiOkResponse({
    description: 'Replay: this Idempotency-Key already placed this order.',
  })
  @ApiBadRequestResponse({
    description: 'Missing or non-UUID Idempotency-Key.',
  })
  @ApiNotFoundResponse({ description: 'Unknown, expired or converted cart.' })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid body, empty cart (`errors.cart`), unavailable items (`errors.items` + `unavailable`), unsupported `payment_method`, or a key already used by another cart (`errors.idempotency_key`).',
  })
  @ApiBadGatewayResponse({
    description:
      'Order kept but the provider failed to create the charge: retry with the same key.',
  })
  async place(
    @IdempotencyKey() idempotencyKey: string,
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: CheckoutDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { order, created } = await this.checkout.placeOrder(
      cartToken,
      idempotencyKey,
      dto,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { data: order };
  }
}

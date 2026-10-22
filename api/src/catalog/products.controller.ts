import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CatalogService } from './catalog.service.js';
import { ProductQueryDto } from './dto/product-query.dto.js';

@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Paginated published products. Envelope: { data, links, meta }.',
  })
  index(@Query() query: ProductQueryDto, @Req() request: Request) {
    const baseUrl = `${request.protocol}://${request.get('host')}${request.path}`;
    return this.catalog.searchProducts(query, baseUrl);
  }

  @Get(':slug')
  async show(@Param('slug') slug: string) {
    return { data: await this.catalog.getProduct(slug) };
  }
}

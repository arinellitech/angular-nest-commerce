import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Active root categories with their children and published product counts.',
  })
  async index() {
    return { data: await this.catalog.listCategories() };
  }

  @Get(':slug')
  async show(@Param('slug') slug: string) {
    return { data: await this.catalog.getCategory(slug) };
  }
}

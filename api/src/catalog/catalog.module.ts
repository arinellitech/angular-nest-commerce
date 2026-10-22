import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [SearchModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

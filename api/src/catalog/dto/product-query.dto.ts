import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PRODUCT_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'name',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** `relevance` when searching, `newest` when browsing. */
export function resolveSort(query: {
  search?: string;
  sort?: ProductSort;
}): ProductSort {
  return query.sort ?? (query.search ? 'relevance' : 'newest');
}

export class ProductQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum price in cents', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price in cents', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional({
    description: '1 | true to show only products with available stock',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  in_stock?: boolean;

  @ApiPropertyOptional({
    enum: PRODUCT_SORTS,
    description: 'Default: `relevance` with `search`, `newest` otherwise',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 60, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  per_page: number = 24;
}

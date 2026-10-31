import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Upper bound per line; keeps a typo from reserving the whole warehouse. */
export const MAX_LINE_QUANTITY = 99;

export class AddCartItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id!: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: MAX_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class ApplyCouponDto {
  @ApiProperty({ example: 'BEMVINDO10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;
}

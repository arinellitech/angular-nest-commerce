import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OrderAccessQueryDto {
  @ApiPropertyOptional({
    description:
      'Signed access token from the order e-mail link (also returned as `data.access_token`).',
  })
  @IsOptional()
  @IsString()
  token?: string;
}

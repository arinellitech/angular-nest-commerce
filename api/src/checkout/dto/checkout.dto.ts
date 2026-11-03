import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { normalizeCpf } from '../../common/cpf.js';
import { IsCpf } from '../../common/validators.js';
import { PaymentMethod } from '../../payments/payment.types.js';

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const; // prettier-ignore

type Transformer = (value: unknown) => unknown;
const onString =
  (fn: (value: string) => string): Transformer =>
  (value) =>
    typeof value === 'string' ? fn(value) : value;

const trim = onString((v) => v.trim());
const digitsOnly = onString((v) => v.replace(/[\s.()-]/g, ''));

// Decorators run bottom-up and the storefront shows `errors[field][0]`: the
// rule closest to the property is the one a missing value reports first.

export class CheckoutCustomerDto {
  @ApiProperty({ example: 'Ana Souza' })
  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Informe o nome completo.' })
  @Length(3, 255, { message: 'Informe o nome completo.' })
  name!: string;

  @ApiProperty({ example: 'ana@example.com' })
  @Transform(({ value }) => onString((v) => v.trim().toLowerCase())(value))
  @MaxLength(255, { message: 'Use no máximo 255 caracteres.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @ApiProperty({
    example: '529.982.247-25',
    description: 'CPF, with or without punctuation. Stored as 11 digits.',
  })
  @Transform(({ value }) => onString((v) => normalizeCpf(v))(value))
  @IsCpf({ message: 'CPF inválido.' })
  document!: string;

  @ApiProperty({
    example: '(11) 98765-4321',
    description: 'Brazilian phone with area code (10 or 11 digits).',
  })
  @Transform(({ value }) => digitsOnly(value))
  @IsString({ message: 'Informe o telefone com DDD.' })
  @Matches(/^\d{10,11}$/, { message: 'Informe o telefone com DDD.' })
  phone!: string;
}

export class ShippingAddressDto {
  @ApiProperty({ example: 'Av. Paulista, 1000' })
  @Transform(({ value }) => trim(value))
  @MaxLength(255, { message: 'Use no máximo 255 caracteres.' })
  @IsString({ message: 'Informe o endereço.' })
  @IsNotEmpty({ message: 'Informe o endereço.' })
  line1!: string;

  @ApiPropertyOptional({ example: 'Apto 12 — Bela Vista' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString({ message: 'Complemento inválido.' })
  @MaxLength(255, { message: 'Use no máximo 255 caracteres.' })
  line2?: string;

  @ApiProperty({ example: 'São Paulo' })
  @Transform(({ value }) => trim(value))
  @MaxLength(255, { message: 'Use no máximo 255 caracteres.' })
  @IsString({ message: 'Informe a cidade.' })
  @IsNotEmpty({ message: 'Informe a cidade.' })
  city!: string;

  @ApiProperty({ example: 'SP', enum: BRAZILIAN_STATES })
  @Transform(({ value }) => onString((v) => v.trim().toUpperCase())(value))
  @IsIn(BRAZILIAN_STATES, { message: 'UF inválida.' })
  state!: string;

  @ApiProperty({ example: '01310-100', description: 'CEP, 8 digits.' })
  @Transform(({ value }) => digitsOnly(value))
  @IsString({ message: 'CEP deve ter 8 dígitos.' })
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  postal_code!: string;

  @ApiPropertyOptional({ example: 'BR', default: 'BR', enum: ['BR'] })
  @Transform(({ value }) =>
    value === null || value === undefined ? 'BR' : value,
  )
  @IsIn(['BR'], { message: 'Entregamos apenas no Brasil.' })
  country: string = 'BR';
}

export class CheckoutDto {
  @ApiProperty({ type: CheckoutCustomerDto })
  @IsObject({ message: 'Informe os dados do cliente.' })
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer!: CheckoutCustomerDto;

  @ApiProperty({ type: ShippingAddressDto })
  @IsObject({ message: 'Informe o endereço de entrega.' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shipping_address!: ShippingAddressDto;

  @ApiProperty({
    enum: Object.values(PaymentMethod),
    example: PaymentMethod.Pix,
    description:
      'The active provider decides which ones are accepted (mock: pix).',
  })
  @IsIn(Object.values(PaymentMethod), {
    message: 'Forma de pagamento inválida.',
  })
  payment_method!: PaymentMethod;
}

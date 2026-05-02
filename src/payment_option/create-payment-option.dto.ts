import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PaymentOptionType } from './payment-option.entity';

export class CreatePaymentOptionDto {
  @IsEnum(PaymentOptionType)
  type!: PaymentOptionType;

  @IsString()
  label!: string;

  @IsOptional()
  isActive?: boolean;
}
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from './payment-method.entity';

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
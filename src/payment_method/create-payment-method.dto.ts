import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from './payment-method.entity';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @IsString()
  accountNumber!: string;

  @IsOptional()
  @IsString()
  accountName?: string;
}
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { PaymentProvider } from 'src/payment_method/payment-method.entity';

export class InitiatePaymentDto {
  @IsNumber()
  invoice_id?: number;

  @IsNumber()
  paymentMethodId?: number; // 🔥 NEW

  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsString()
  customer_phone?: string;
}
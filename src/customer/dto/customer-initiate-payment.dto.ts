import { IsNotEmpty, IsOptional, IsString, Matches, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerInitiatePaymentDto {
  @Type(() => Number)
  @IsInt()
  paymentOptionId!: number;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  payerPhone!: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}

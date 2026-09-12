import { IsDateString, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsString()
  @IsNotEmpty()
  merchantReference!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsInt()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsDateString()
  occurredAt!: string;
}

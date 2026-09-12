import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushNewInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  pushDueReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  pushPaymentStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  emailReceipts?: boolean;
}

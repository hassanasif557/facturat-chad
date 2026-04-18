import { IsEnum } from 'class-validator';
import { InvoiceStatus } from '../invoice.entity';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;
}
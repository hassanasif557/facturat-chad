import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportInvoiceIssueDto {
  @IsIn([
    'unknown_invoice',
    'incorrect_amount',
    'incorrect_item',
    'incorrect_customer',
    'other',
  ])
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

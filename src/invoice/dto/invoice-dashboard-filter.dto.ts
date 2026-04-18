import { IsOptional, IsDateString } from 'class-validator';

export class InvoiceDashboardFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
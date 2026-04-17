import { IsNotEmpty } from 'class-validator';

export class CreateInvoiceDto {
  @IsNotEmpty()
  customerName!: string;

  @IsNotEmpty()
  date!: string;

  @IsNotEmpty()
  totalAmount!: number;

  @IsNotEmpty()
  products!: string; // JSON string
}
import { IsNumber } from 'class-validator';

export class SubscribeDto {
  @IsNumber()
  planId!: number;
}
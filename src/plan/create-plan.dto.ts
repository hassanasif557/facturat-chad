import { IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';

export class CreatePlanDto {
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  invoiceLimit!: number;

  @IsNumber()
  userLimit!: number;

  @IsNumber()
  durationDays!: number;

  @IsBoolean()
  isTeamPlan!: boolean;
}
import {
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsString,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
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
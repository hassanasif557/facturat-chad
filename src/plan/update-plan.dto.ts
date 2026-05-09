import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  invoiceLimit?: number;

  @IsOptional()
  @IsNumber()
  userLimit?: number;

  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isTeamPlan?: boolean;
}
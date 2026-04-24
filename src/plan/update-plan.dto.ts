import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

export class UpdatePlanDto {
  name?: string;
  price?: number;
  invoiceLimit?: number;
  userLimit?: number;
  durationDays?: number;
  isTeamPlan?: boolean;
}
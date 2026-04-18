import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../user.entity';

export class UpdateVerificationDto {
  @IsEnum(VerificationStatus)
  verificationStatus!: VerificationStatus;
}
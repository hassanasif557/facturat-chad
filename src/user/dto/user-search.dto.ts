import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { OrgRole, VerificationStatus } from '../user.entity';

export class UserSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tax_number?: string;

  @IsOptional()
  @IsEnum(OrgRole)
  orgRole?: OrgRole;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  createdFrom?: Date;

  @IsOptional()
  createdTo?: Date;

  @IsOptional()
  updatedFrom?: Date;

  @IsOptional()
  updatedTo?: Date;

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}
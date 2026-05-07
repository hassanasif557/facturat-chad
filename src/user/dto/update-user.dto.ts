import {
  IsEnum,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';

import { Role, VerificationStatus } from '../user.entity';

import { IsPhoneValid } from 'src/common/validators/is-phone-valid.validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  // ✅ VALIDATE PHONE
  @IsOptional()
  @Validate(IsPhoneValid)
  phone?: string;

  @IsOptional()
  @IsString()
  tax_number?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;
}
import {
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';

import { IsPhoneValid } from 'src/common/validators/is-phone-valid.validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Validate(IsPhoneValid)
  phone?: string;

  @IsOptional()
  @IsString()
  tax_number?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
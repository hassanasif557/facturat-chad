import {
  IsEmail,
  IsString,
  Length,
  Validate,
  IsOptional,
} from 'class-validator';

import { IsPhoneValid } from 'src/common/validators/is-phone-valid.validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @Length(6, 20)
  password!: string;

  // ✅ REQUIRED + VALIDATED
  @Validate(IsPhoneValid)
  phone!: string;

  @IsString()
  tax_number!: string;

  // ✅ OPTIONAL IMAGE
  @IsOptional()
  @IsString()
  profilePicture?: string;
}
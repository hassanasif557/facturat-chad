import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  // ✅ INTERNATIONAL PHONE VALIDATION
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Phone number must be in international format. Example: +923001234567',
  })
  phone!: string;

  @IsNotEmpty()
  tax_number!: string;
}
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
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

  @IsOptional()
  tax_number?: string;

  @IsOptional()
  @IsIn(['user', 'customer'])
  role?: 'user' | 'customer';
}
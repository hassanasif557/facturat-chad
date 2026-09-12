import { IsIn, IsOptional, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Phone number must be in international format. Example: +923001234567',
  })
  phone!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(['user', 'admin', 'customer'])
  requestedRole?: 'user' | 'admin' | 'customer';
}
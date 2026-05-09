import { IsNotEmpty, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Phone number must be in international format. Example: +923001234567',
  })
  phone!: string;
}
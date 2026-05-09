import { IsNotEmpty } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  phone!: string;

  @IsNotEmpty()
  otp!: string;
}
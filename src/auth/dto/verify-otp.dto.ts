import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsNotEmpty()
  otp!: string;

  @IsOptional()
  device?: {
    platform?: string;
    deviceId?: string;
    appVersion?: string;
  };
}
import { IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  challengeId?: string;

  @IsOptional()
  otp?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
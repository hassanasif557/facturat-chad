import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SendBroadcastDto {
  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  toAll?: boolean; // true = all users, false = org only

  @IsOptional()
  orgId?: number;
}
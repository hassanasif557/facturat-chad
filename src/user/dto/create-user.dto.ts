import { IsEmail, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @Length(6, 20)
  password!: string;

  @IsString()
  @Length(10, 15)
  phone!: string;

  @IsString()
  tax_number!: string;
}
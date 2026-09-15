import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString, IsInt, Min } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsDateString()
  @IsOptional()
  anniversary?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  loyaltyPoints?: number;
}

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  code: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  gst?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  pan?: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  creditLimit?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  paymentTerms?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  bankDetails?: any;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  openingBalance?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  preferredSupplier?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  status?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

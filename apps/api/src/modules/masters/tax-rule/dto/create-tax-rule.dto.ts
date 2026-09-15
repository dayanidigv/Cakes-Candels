import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaxRuleDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsNumber()
  @ApiProperty()
  rate: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  hsn?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false })
  effectiveFrom?: Date;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false })
  effectiveTo?: Date;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

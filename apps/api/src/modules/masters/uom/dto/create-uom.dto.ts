import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUomDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  symbol: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  baseUnitId?: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  conversionFactor?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  allowDecimal?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

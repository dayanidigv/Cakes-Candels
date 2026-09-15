import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNumberSeriesDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  documentType: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  prefix: string;

  @IsNumber()
  @ApiProperty()
  currentNumber: number;

  @IsNumber()
  @ApiProperty()
  length: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  suffix?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

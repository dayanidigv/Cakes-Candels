import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStorageLocationDto {

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  branchId: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  locationCode?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  temperatureType?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  capacity?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  registrationNumber: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  capacity?: number;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  capacityUomId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  driverName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  driverPhone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  status?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

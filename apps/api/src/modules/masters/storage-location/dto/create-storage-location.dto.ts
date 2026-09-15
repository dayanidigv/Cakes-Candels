import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsEmail, IsUUID } from 'class-validator';

export class CreateStorageLocationDto {
  @ApiProperty() @IsUUID() @IsNotEmpty() branchId: string;
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() isActive?: boolean;
}

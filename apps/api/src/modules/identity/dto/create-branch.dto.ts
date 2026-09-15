import { IsString, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@cc-erp/database';

export class CreateBranchDto {
  @ApiProperty({ description: 'Organization UUID reference' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'The unique name of the branch', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ enum: LocationType, description: 'Type of location (e.g. FACTORY, RETAIL_BRANCH)' })
  @IsEnum(LocationType)
  type: LocationType;

  @ApiProperty({ description: 'Street Address', minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  address: string;

  @ApiPropertyOptional({ description: 'Phone contact number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'GSTIN identification number', minLength: 3, maxLength: 50 })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  gstin?: string;
}

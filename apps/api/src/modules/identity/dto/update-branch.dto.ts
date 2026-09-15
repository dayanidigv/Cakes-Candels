import { IsString, IsOptional, Length, IsEnum, IsUUID, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@cc-erp/database';

export class UpdateBranchDto {
  @ApiPropertyOptional({ description: 'Organization UUID reference' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'The unique name of the branch', minLength: 2, maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ enum: LocationType, description: 'Type of location' })
  @IsEnum(LocationType)
  @IsOptional()
  type?: LocationType;

  @ApiPropertyOptional({ description: 'Street Address', minLength: 5, maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(5, 500)
  address?: string;

  @ApiPropertyOptional({ description: 'Phone contact number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'GSTIN identification number', minLength: 3, maxLength: 50 })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  gstin?: string;

  @ApiPropertyOptional({ description: 'Is active status flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

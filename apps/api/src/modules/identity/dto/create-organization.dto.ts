import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Unique short code for the organization (e.g. CC001)', minLength: 2, maxLength: 20 })
  @IsString()
  @Length(2, 20)
  code: string;

  @ApiProperty({ description: 'The unique name of the organization', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ description: 'Tax Identifier (e.g. GSTIN/EIN)', minLength: 3, maxLength: 50 })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  taxIdentifier?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logoUrl?: string;
}

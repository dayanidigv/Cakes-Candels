import { IsString, IsOptional, Length, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'The name of the organization', minLength: 2, maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ description: 'Tax Identifier', minLength: 3, maxLength: 50 })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  taxIdentifier?: string;

  @ApiPropertyOptional({ description: 'Is active status flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

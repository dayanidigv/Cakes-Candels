import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductAttributeValueDto {
  @ApiProperty({ description: 'Value of the attribute (e.g., Vanilla)' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ description: 'Is active flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

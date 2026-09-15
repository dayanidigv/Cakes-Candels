import { IsString, IsOptional, Length, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrUpdateSettingDto {
  @ApiProperty({ description: 'The unique setting key', minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  key: string;

  @ApiProperty({ description: 'The value configuration string' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ description: 'Description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Branch UUID override reference' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}

import { IsString, IsBoolean, IsOptional, Length, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetFeatureFlagDto {
  @ApiProperty({ description: 'The unique feature flag key', minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  key: string;

  @ApiProperty({ description: 'Is enabled state flag' })
  @IsBoolean()
  isEnabled: boolean;

  @ApiPropertyOptional({ description: 'Branch UUID override reference' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}

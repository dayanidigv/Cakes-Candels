import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxType } from '@prisma/client';

export class CreateExpenseCategoryMappingDto {
  @ApiProperty({ description: 'Category display name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique category code (e.g. RENT, UTILITIES)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Default COA Expense Account ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @ApiPropertyOptional({ enum: TaxType, default: TaxType.NONE, description: 'Default GST tax rate' })
  @IsOptional()
  @IsEnum(TaxType)
  defaultTaxType?: TaxType;

  @ApiPropertyOptional({ description: 'Whether expenses require manager approval', default: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ description: 'Approval threshold amount', default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvalThreshold?: number;
}

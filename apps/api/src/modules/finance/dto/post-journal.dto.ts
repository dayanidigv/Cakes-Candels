import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalLineDto {
  @IsNotEmpty()
  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class PostJournalCommandDto {
  @IsNotEmpty()
  @IsDateString()
  postingDate: string; // "YYYY-MM-DD"

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsNotEmpty()
  @IsString()
  sourceModule: string; // "MANUAL", "PAYROLL", "PROCUREMENT", "SALES", "POS", "EXPENSE", "INVENTORY"

  @IsNotEmpty()
  @IsString()
  sourceEntityType: string; // "MANUAL_JOURNAL", "PAYROLL_RUN", "GOODS_RECEIPT_NOTE", etc.

  @IsNotEmpty()
  @IsUUID()
  sourceEntityId: string;

  @IsOptional()
  @IsString()
  sourceReference?: string; // Optional qualifier: e.g. "DEFAULT", "REVERSAL", "LINE_1"

  @IsOptional()
  @IsString()
  referenceNumber?: string; // External ref: e.g. "INV-9921", "UTR-81726"

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

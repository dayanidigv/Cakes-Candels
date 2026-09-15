import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpensePaymentType, TaxType } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Branch ID where expense was incurred' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'Expense Account ID (Debit account in COA)' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  expenseAccountId: string;

  @ApiProperty({ description: 'Payment/Payable Account ID (Credit account in COA)' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  paymentAccountId: string;

  @ApiPropertyOptional({ description: 'Optional Vendor / Supplier ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ enum: ExpensePaymentType, description: 'Payment method used' })
  @IsEnum(ExpensePaymentType)
  paymentType: ExpensePaymentType;

  @ApiProperty({ description: 'Date expense was incurred (YYYY-MM-DD)' })
  @IsDateString()
  expenseDate: string;

  @ApiPropertyOptional({ description: 'Due date if credit purchase (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Vendor invoice / bill number' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ description: 'Net expense base amount (before tax)' })
  @IsNumber()
  @Min(0.01)
  baseAmount: number;

  @ApiPropertyOptional({ enum: TaxType, default: TaxType.NONE, description: 'GST tax rate' })
  @IsOptional()
  @IsEnum(TaxType)
  taxType?: TaxType;

  @ApiProperty({ description: 'Business justification / memo' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Receipt scan / artifact URL' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate creation protection' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

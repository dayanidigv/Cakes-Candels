import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  Max,
  IsUUID,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollRunStatus } from '@prisma/client';

export class CreatePayrollPeriodDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month!: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class CreatePayrollRunDto {
  @IsUUID()
  @IsNotEmpty()
  payrollPeriodId!: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class CalculatePayrollRunDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class SubmitPayrollApprovalDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryPayrollRunDto {
  @IsUUID()
  @IsOptional()
  payrollPeriodId?: string;

  @IsEnum(PayrollRunStatus)
  @IsOptional()
  status?: PayrollRunStatus;
}

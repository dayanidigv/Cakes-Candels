import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayslipStatus } from '@prisma/client';

export class GeneratePayslipsDto {
  @ApiProperty({ description: 'Payroll Run ID to generate payslips for' })
  @IsUUID()
  payrollRunId: string;

  @ApiPropertyOptional({ description: 'Optional Idempotency Key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class QueryPayslipDto {
  @ApiPropertyOptional({ description: 'Filter by Payroll Run ID' })
  @IsOptional()
  @IsUUID()
  payrollRunId?: string;

  @ApiPropertyOptional({ description: 'Filter by Employee ID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: PayslipStatus, description: 'Filter by Payslip Status' })
  @IsOptional()
  @IsEnum(PayslipStatus)
  status?: PayslipStatus;
}

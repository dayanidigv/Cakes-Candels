import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['EARNING', 'DEDUCTION', 'STATUTORY'])
  type!: 'EARNING' | 'DEDUCTION' | 'STATUTORY';

  @IsBoolean()
  @IsOptional()
  isTaxable?: boolean;
}

export class UpdateSalaryComponentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['EARNING', 'DEDUCTION', 'STATUTORY'])
  @IsOptional()
  type?: 'EARNING' | 'DEDUCTION' | 'STATUTORY';

  @IsBoolean()
  @IsOptional()
  isTaxable?: boolean;
}

export class CreateSalaryStructureDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveDate!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseSalary!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  hra?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  conveyance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  specialAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  pfContribution?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  esiContribution?: number;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class UpdateSalaryStructureDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  baseSalary?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  hra?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  conveyance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  specialAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  pfContribution?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  esiContribution?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ResolveSalaryQueryDto {
  @IsDateString()
  @IsNotEmpty()
  targetDate!: string;
}

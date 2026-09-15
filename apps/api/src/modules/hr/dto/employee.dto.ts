import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { EmploymentType, EmploymentStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  employeeCode!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfJoining!: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsUUID()
  @IsNotEmpty()
  assignedBranchId!: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  designationId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  @IsString()
  @IsOptional()
  bankIfscCode?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  pfAccountNo?: string;

  @IsString()
  @IsOptional()
  esiNumber?: string;
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  designationId?: string;

  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  @IsString()
  @IsOptional()
  bankIfscCode?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  pfAccountNo?: string;

  @IsString()
  @IsOptional()
  esiNumber?: string;
}

export class ChangeEmployeeStatusDto {
  @IsEnum(EmploymentStatus)
  @IsNotEmpty()
  status!: EmploymentStatus;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class AssignBranchDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}

export class AssignDepartmentDto {
  @IsUUID()
  @IsNotEmpty()
  departmentId!: string;
}

export class AssignDesignationDto {
  @IsUUID()
  @IsNotEmpty()
  designationId!: string;
}

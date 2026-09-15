import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  annualDays!: number;

  @IsBoolean()
  @IsOptional()
  isCarryForward?: boolean;
}

export class CreateLeavePolicyDto {
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxContinuousDays?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  noticeDaysRequired?: number;

  @IsBoolean()
  @IsOptional()
  encashable?: boolean;
}

export class AllocateLeaveDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  leaveTypeId!: string;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsInt()
  @Min(1)
  days!: number;
}

export class CreateLeaveRequestDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  leaveTypeId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApproveLeaveRequestDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class RejectLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class CancelLeaveRequestDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

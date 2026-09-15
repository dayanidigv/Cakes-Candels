import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsString()
  @IsOptional()
  source?: string;
}

export class CheckOutDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class ScheduleAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsDateString()
  @IsNotEmpty()
  workDate!: string;
}

export class AttendanceCorrectionRequestDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  @IsNotEmpty()
  workDate!: string;

  @IsDateString()
  @IsOptional()
  requestedIn?: string;

  @IsDateString()
  @IsOptional()
  requestedOut?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApproveCorrectionDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class RejectCorrectionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

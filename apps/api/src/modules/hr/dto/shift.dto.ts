import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Matches, IsDateString, IsUUID, IsBoolean } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm 24-hour format' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm 24-hour format' })
  endTime!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  gracePeriodMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  breakDurationMinutes?: number;
}

export class UpdateShiftDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm 24-hour format' })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm 24-hour format' })
  @IsOptional()
  endTime?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  gracePeriodMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  breakDurationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignShiftDto {
  @IsUUID()
  @IsNotEmpty()
  shiftMasterId!: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
